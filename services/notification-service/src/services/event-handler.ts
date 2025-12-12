import { consumer } from '../config/kafka';
import { pool, redis } from '../config/database';
import { publishNotification } from '../config/socket';

enum EventType {
  APPOINTMENT_CREATED = 'appointment.created',
  APPOINTMENT_APPROVED = 'appointment.approved',
  APPOINTMENT_CANCELLED = 'appointment.cancelled',
  APPOINTMENT_REJECTED = 'appointment.rejected',
  APPOINTMENT_COMPLETED = 'appointment.completed',
}

// Helper to format date safely
const formatDate = (dateValue: any): string => {
  try {
    if (!dateValue) return 'scheduled date';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'scheduled date';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'scheduled date';
  }
};

// Helper to format time safely
const formatTime = (timeValue: any): string => {
  if (!timeValue) return 'scheduled time';
  return timeValue;
};

// Transform notification to camelCase for socket emission
const transformNotification = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  status: row.status,
  read: row.read,
  metadata: row.metadata,
  sentAt: row.sent_at,
  createdAt: row.created_at,
});

// Create notification in database
const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'IN_APP',
  metadata?: any
) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, status, metadata, sent_at)
       VALUES ($1, $2, $3, $4, 'SENT', $5, NOW())
       RETURNING *`,
      [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );

    const notification = result.rows[0];
    const transformedNotification = transformNotification(notification);

    // Invalidate user's notification cache so they get fresh data
    const keys = await redis.keys(`notifications:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    // Publish to Redis for real-time delivery (transformed)
    await publishNotification(transformedNotification);

    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

export const startKafkaConsumer = async () => {
  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}');
          const eventType = message.headers?.['event-type']?.toString();

          console.log(`📥 Received event: ${eventType}`, event);

          switch (eventType) {
            case EventType.APPOINTMENT_CREATED:
              await handleAppointmentCreated(event);
              break;

            case EventType.APPOINTMENT_APPROVED:
              await handleAppointmentApproved(event);
              break;

            case EventType.APPOINTMENT_CANCELLED:
              await handleAppointmentCancelled(event);
              break;

            case EventType.APPOINTMENT_REJECTED:
              await handleAppointmentRejected(event);
              break;

            case EventType.APPOINTMENT_COMPLETED:
              await handleAppointmentCompleted(event);
              break;

            default:
              console.log(`⚠️ Unknown event type: ${eventType}`);
          }
        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      },
    });

    console.log('🎧 Kafka consumer is listening for events...');
  } catch (error) {
    console.error('❌ Error starting Kafka consumer:', error);
  }
};

// Event handlers
const handleAppointmentCreated = async (event: any) => {
  console.log('📥 Processing APPOINTMENT_CREATED event:', event);
  const dateStr = formatDate(event.date);
  const timeStr = formatTime(event.time);
  const doctorName = event.doctorName || 'your doctor';
  const patientName = event.patientName || 'a patient';

  // Notify patient
  console.log(`📧 Creating notification for patient: ${event.patientId}`);
  await createNotification(
    event.patientId,
    'Appointment Created',
    `Your appointment request with Dr. ${doctorName} on ${dateStr} at ${timeStr} has been submitted and is pending approval.`,
    'IN_APP',
    { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_CREATED' }
  );

  // Notify doctor
  console.log(`📧 Creating notification for doctor: ${event.doctorId}`);
  await createNotification(
    event.doctorId,
    'New Appointment Request',
    `You have a new appointment request from ${patientName} on ${dateStr} at ${timeStr}.`,
    'IN_APP',
    { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_CREATED' }
  );

  console.log('✅ Appointment created notifications sent');
};

const handleAppointmentApproved = async (event: any) => {
  const dateStr = formatDate(event.date);
  const timeStr = formatTime(event.time);

  // Notify patient
  await createNotification(
    event.patientId,
    'Appointment Approved',
    `Your appointment on ${dateStr} at ${timeStr} has been approved!`,
    'IN_APP',
    { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_APPROVED' }
  );

  console.log('✅ Appointment approved notification sent');
};

const handleAppointmentCancelled = async (event: any) => {
  const dateStr = formatDate(event.date);
  const timeStr = formatTime(event.time);
  const cancelledBy = event.cancelledBy || 'UNKNOWN';
  const patientName = event.patientName || 'Patient';
  const doctorName = event.doctorName || 'Doctor';

  // Notify patient with context
  if (event.patientId) {
    let patientMessage = '';
    if (cancelledBy === 'PATIENT') {
      patientMessage = `Your appointment on ${dateStr} at ${timeStr} has been cancelled by you.`;
    } else if (cancelledBy === 'DOCTOR') {
      patientMessage = `Your appointment on ${dateStr} at ${timeStr} has been cancelled by Dr. ${doctorName}.`;
    } else if (cancelledBy === 'ADMIN') {
      patientMessage = `Your appointment on ${dateStr} at ${timeStr} has been cancelled by an administrator.`;
    } else {
      patientMessage = `Your appointment on ${dateStr} at ${timeStr} has been cancelled.`;
    }

    await createNotification(
      event.patientId,
      'Appointment Cancelled',
      patientMessage,
      'IN_APP',
      { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_CANCELLED', cancelledBy }
    );
  }

  // Notify doctor with context
  if (event.doctorId) {
    let doctorMessage = '';
    if (cancelledBy === 'DOCTOR') {
      doctorMessage = `Appointment with ${patientName} on ${dateStr} at ${timeStr} has been cancelled by you.`;
    } else if (cancelledBy === 'PATIENT') {
      doctorMessage = `Appointment with ${patientName} on ${dateStr} at ${timeStr} has been cancelled by the patient.`;
    } else if (cancelledBy === 'ADMIN') {
      doctorMessage = `Appointment with ${patientName} on ${dateStr} at ${timeStr} has been cancelled by an administrator.`;
    } else {
      doctorMessage = `Appointment with ${patientName} on ${dateStr} at ${timeStr} has been cancelled.`;
    }

    await createNotification(
      event.doctorId,
      'Appointment Cancelled',
      doctorMessage,
      'IN_APP',
      { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_CANCELLED', cancelledBy }
    );
  }

  console.log('✅ Appointment cancelled notifications sent');
};

const handleAppointmentRejected = async (event: any) => {
  const dateStr = formatDate(event.date);
  const timeStr = formatTime(event.time);
  const doctorName = event.doctorName || 'Doctor';
  const patientName = event.patientName || 'Patient';
  const reason = event.rejectionReason ? ` Reason: ${event.rejectionReason}` : '';

  // Notify patient
  if (event.patientId) {
    await createNotification(
      event.patientId,
      'Appointment Rejected',
      `Your appointment request on ${dateStr} at ${timeStr} has been rejected by Dr. ${doctorName}.${reason}`,
      'IN_APP',
      { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_REJECTED', reason: event.rejectionReason }
    );
  }

  // Notify doctor (confirmation)
  if (event.doctorId) {
    await createNotification(
      event.doctorId,
      'Appointment Rejected',
      `You have rejected the appointment request from ${patientName} on ${dateStr} at ${timeStr}.`,
      'IN_APP',
      { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_REJECTED' }
    );
  }

  console.log('✅ Appointment rejected notifications sent');
};

const handleAppointmentCompleted = async (event: any) => {
  const dateStr = formatDate(event.date);

  // Notify patient
  await createNotification(
    event.patientId,
    'Appointment Completed',
    `Your appointment on ${dateStr} has been marked as completed.`,
    'IN_APP',
    { appointmentId: event.appointmentId, eventType: 'APPOINTMENT_COMPLETED' }
  );

  console.log('✅ Appointment completed notification sent');
};
