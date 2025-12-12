import { Router } from 'express';
import {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  getAllAppointments,
  approveAppointment,
  completeAppointment,
  cancelAppointmentPatch,
  rejectAppointment
} from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createAppointmentValidation,
  updateAppointmentValidation
} from '../middleware/validation.middleware';
import { appointmentLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', appointmentLimiter, createAppointmentValidation, createAppointment);
router.get('/', getAllAppointments); // Admin only - get all appointments
router.get('/my', getMyAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/approve', approveAppointment); // Doctor approves appointment
router.patch('/:id/complete', completeAppointment); // Doctor completes appointment
router.patch('/:id/cancel', cancelAppointmentPatch); // Cancel appointment
router.patch('/:id/reject', rejectAppointment); // Doctor rejects appointment
router.patch('/:id', updateAppointmentValidation, updateAppointment);
router.delete('/:id', cancelAppointment);

export default router;
