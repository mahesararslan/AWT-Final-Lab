import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { validationResult } from 'express-validator';
import { pool, redis } from '../config/database';
import { publishEvent, EventType } from '../config/kafka';
import axios from 'axios';

// Helper function to get user details from auth service
const getUserDetails = async (userId: string) => {
  try {
    const response = await axios.get(
      `${process.env.AUTH_SERVICE_URL}/api/auth/users/${userId}`
    );
    return response.data.data.user;
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
};

export const createAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err: any) => err.msg).join(', ');
      return res.status(400).json({
        success: false,
        message: errorMessages,
        errors: errors.array()
      });
    }

    if (!req.user || req.user.role !== 'PATIENT') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can create appointments'
      });
    }

    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
    const patientId = req.user.userId;

    // Also support legacy field names
    const date = appointmentDate || req.body.date;
    const time = appointmentTime || req.body.time;

    // Check if doctor exists
    const doctorResponse = await axios.get(
      `${process.env.AUTH_SERVICE_URL}/api/auth/users/${doctorId}`
    ).catch(() => null);

    if (!doctorResponse || !doctorResponse.data.success) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const doctor = doctorResponse.data.data.user;

    // Check for existing appointment at the same time
    const existingAppointment = await pool.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND date = $2 AND time = $3 
       AND status IN ('PENDING', 'APPROVED')`,
      [doctorId, date, time]
    );

    if (existingAppointment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    // Create appointment
    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, date, time, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patientId, doctorId, date, time, reason]
    );

    const appointment = result.rows[0];

    // Get patient and doctor details
    const patient = await getUserDetails(patientId);

    // Publish event to Kafka
    try {
      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_CREATED,
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id,
        date: appointment.date,
        time: appointment.time,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
        doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : 'Unknown',
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
      // Continue even if Kafka fails
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${patientId}`);
    await redis.del(`appointments:doctor:${doctorId}`);
    await redis.del('appointments:all');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: { appointment }
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating appointment'
    });
  }
};

export const getMyAppointments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.userId;
    const role = req.user.role;
    const cacheKey = `appointments:${role.toLowerCase()}:${userId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: { appointments: JSON.parse(cached) },
        cached: true
      });
    }

    let query: string;
    let values: string[];

    if (role === 'PATIENT') {
      query = `SELECT * FROM appointments WHERE patient_id = $1 ORDER BY date DESC, time DESC`;
      values = [userId];
    } else if (role === 'DOCTOR') {
      query = `SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY date DESC, time DESC`;
      values = [userId];
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const result = await pool.query(query, values);
    
    // Enrich appointments with user details
    const enrichedAppointments = await Promise.all(
      result.rows.map(async (apt) => {
        const doctor = await getUserDetails(apt.doctor_id);
        const patient = await getUserDetails(apt.patient_id);
        return {
          id: apt.id,
          patientId: apt.patient_id,
          doctorId: apt.doctor_id,
          date: apt.date,
          time: apt.time,
          reason: apt.reason,
          status: apt.status,
          notes: apt.notes,
          cancelledBy: apt.cancelled_by,
          cancelledById: apt.cancelled_by_id,
          createdAt: apt.created_at,
          updatedAt: apt.updated_at,
          patientEmail: patient?.email,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
          doctorEmail: doctor?.email,
          doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
          doctorSpecialization: doctor?.specialization,
        };
      })
    );

    // Cache for 2 minutes
    await redis.setex(cacheKey, 120, JSON.stringify(enrichedAppointments));

    res.json({
      success: true,
      data: { appointments: enrichedAppointments }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments'
    });
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Check authorization
    if (
      appointment.patient_id !== req.user.userId &&
      appointment.doctor_id !== req.user.userId &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    res.json({
      success: true,
      data: { appointment }
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment'
    });
  }
};

export const updateAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get current appointment
    const currentResult = await pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const currentAppointment = currentResult.rows[0];

    // Authorization check
    if (
      currentAppointment.doctor_id !== req.user.userId &&
      currentAppointment.patient_id !== req.user.userId &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Only doctors can approve appointments
    if (status === 'APPROVED' && currentAppointment.doctor_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can approve appointments'
      });
    }

    // Update appointment
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    if (status) {
      updateFields.push(`status = $${paramCounter}`);
      values.push(status);
      paramCounter++;
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCounter}`);
      values.push(notes);
      paramCounter++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE appointments SET ${updateFields.join(', ')} 
       WHERE id = $${paramCounter} RETURNING *`,
      values
    );

    const updatedAppointment = result.rows[0];

    // Publish events based on status change
    if (status && status !== currentAppointment.status) {
      try {
        const patient = await getUserDetails(updatedAppointment.patient_id);
        const doctor = await getUserDetails(updatedAppointment.doctor_id);

        let eventType: EventType | null = null;

        if (status === 'APPROVED') {
          eventType = EventType.APPOINTMENT_APPROVED;
        } else if (status === 'CANCELLED') {
          eventType = EventType.APPOINTMENT_CANCELLED;
        } else if (status === 'COMPLETED') {
          eventType = EventType.APPOINTMENT_COMPLETED;
        }

        if (eventType) {
          await publishEvent('appointment-events', {
            type: eventType,
            appointmentId: updatedAppointment.id,
            patientId: updatedAppointment.patient_id,
            doctorId: updatedAppointment.doctor_id,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            patientEmail: patient?.email,
            doctorEmail: doctor?.email,
            status: updatedAppointment.status,
            timestamp: new Date().toISOString()
          });
        }
      } catch (kafkaError) {
        console.error('Kafka event publishing failed:', kafkaError);
      }
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment'
    });
  }
};

export const cancelAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Check if user can cancel
    if (
      appointment.patient_id !== req.user.userId &&
      appointment.doctor_id !== req.user.userId &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Cannot cancel completed appointments
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed appointments'
      });
    }

    // Update status
    const updateResult = await pool.query(
      `UPDATE appointments SET status = 'CANCELLED', notes = $1 WHERE id = $2 RETURNING *`,
      [reason || 'Cancelled by user', id]
    );

    const updatedAppointment = updateResult.rows[0];

    // Publish cancellation event
    try {
      const patient = await getUserDetails(updatedAppointment.patient_id);
      const doctor = await getUserDetails(updatedAppointment.doctor_id);

      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_CANCELLED,
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patient_id,
        doctorId: updatedAppointment.doctor_id,
        cancelledBy: req.user.userId,
        reason,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment'
    });
  }
};

export const getAllAppointments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Only admins can get all appointments
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const cacheKey = 'appointments:all';

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: { appointments: JSON.parse(cached) },
        cached: true
      });
    }

    const result = await pool.query(
      `SELECT * FROM appointments ORDER BY created_at DESC`
    );

    // Enrich appointments with user details
    const enrichedAppointments = await Promise.all(
      result.rows.map(async (apt) => {
        const doctor = await getUserDetails(apt.doctor_id);
        const patient = await getUserDetails(apt.patient_id);
        return {
          id: apt.id,
          patientId: apt.patient_id,
          doctorId: apt.doctor_id,
          date: apt.date,
          time: apt.time,
          reason: apt.reason,
          status: apt.status,
          notes: apt.notes,
          cancelledBy: apt.cancelled_by,
          cancelledById: apt.cancelled_by_id,
          createdAt: apt.created_at,
          updatedAt: apt.updated_at,
          patientEmail: patient?.email,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
          doctorEmail: doctor?.email,
          doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
          doctorSpecialization: doctor?.specialization,
        };
      })
    );

    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(enrichedAppointments));

    res.json({
      success: true,
      data: { appointments: enrichedAppointments }
    });
  } catch (error) {
    console.error('Get all appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments'
    });
  }
};

// Approve appointment (Doctor only)
export const approveAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Only the assigned doctor can approve
    if (appointment.doctor_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can approve appointments'
      });
    }

    if (appointment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be approved'
      });
    }

    const updateResult = await pool.query(
      `UPDATE appointments SET status = 'APPROVED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const updatedAppointment = updateResult.rows[0];

    // Publish event
    try {
      const patient = await getUserDetails(updatedAppointment.patient_id);
      const doctor = await getUserDetails(updatedAppointment.doctor_id);

      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_APPROVED,
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patient_id,
        doctorId: updatedAppointment.doctor_id,
        date: updatedAppointment.date,
        time: updatedAppointment.time,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
        doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
        status: 'APPROVED',
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Approve appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving appointment'
    });
  }
};

// Complete appointment (Doctor only)
export const completeAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Only the assigned doctor can complete
    if (appointment.doctor_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can complete appointments'
      });
    }

    if (appointment.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved appointments can be completed'
      });
    }

    const updateResult = await pool.query(
      `UPDATE appointments SET status = 'COMPLETED', notes = COALESCE($1, notes), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [notes, id]
    );

    const updatedAppointment = updateResult.rows[0];

    // Publish event
    try {
      const patient = await getUserDetails(updatedAppointment.patient_id);
      const doctor = await getUserDetails(updatedAppointment.doctor_id);

      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_COMPLETED,
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patient_id,
        doctorId: updatedAppointment.doctor_id,
        date: updatedAppointment.date,
        time: updatedAppointment.time,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
        doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment completed successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing appointment'
    });
  }
};

// Cancel appointment via PATCH (for frontend compatibility)
export const cancelAppointmentPatch = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Check if user can cancel
    if (
      appointment.patient_id !== req.user.userId &&
      appointment.doctor_id !== req.user.userId &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed appointments'
      });
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled or rejected'
      });
    }

    // Track who cancelled
    const cancelledByRole = req.user.role;
    const cancelledById = req.user.userId;

    const updateResult = await pool.query(
      `UPDATE appointments SET status = 'CANCELLED', cancelled_by = $1, cancelled_by_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [cancelledByRole, cancelledById, id]
    );

    const updatedAppointment = updateResult.rows[0];

    // Publish event
    try {
      const patient = await getUserDetails(updatedAppointment.patient_id);
      const doctor = await getUserDetails(updatedAppointment.doctor_id);

      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_CANCELLED,
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patient_id,
        doctorId: updatedAppointment.doctor_id,
        date: updatedAppointment.date,
        time: updatedAppointment.time,
        cancelledBy: cancelledByRole,
        cancelledById: cancelledById,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
        doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment'
    });
  }
};

// Reject appointment (Doctor only) - for pending appointments
export const rejectAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = result.rows[0];

    // Only the assigned doctor can reject
    if (appointment.doctor_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can reject appointments'
      });
    }

    if (appointment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be rejected'
      });
    }

    const updateResult = await pool.query(
      `UPDATE appointments SET status = 'REJECTED', cancelled_by = 'DOCTOR', cancelled_by_id = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [req.user.userId, reason, id]
    );

    const updatedAppointment = updateResult.rows[0];

    // Publish event
    try {
      const patient = await getUserDetails(updatedAppointment.patient_id);
      const doctor = await getUserDetails(updatedAppointment.doctor_id);

      await publishEvent('appointment-events', {
        type: EventType.APPOINTMENT_REJECTED,
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patient_id,
        doctorId: updatedAppointment.doctor_id,
        date: updatedAppointment.date,
        time: updatedAppointment.time,
        rejectedBy: req.user.userId,
        rejectionReason: reason,
        patientEmail: patient?.email,
        doctorEmail: doctor?.email,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
        doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
        timestamp: new Date().toISOString()
      });
    } catch (kafkaError) {
      console.error('Kafka event publishing failed:', kafkaError);
    }

    // Invalidate cache
    await redis.del(`appointments:patient:${updatedAppointment.patient_id}`);
    await redis.del(`appointments:doctor:${updatedAppointment.doctor_id}`);
    await redis.del('appointments:all');

    res.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting appointment'
    });
  }
};
