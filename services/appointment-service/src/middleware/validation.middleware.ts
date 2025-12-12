import { body, ValidationChain } from 'express-validator';

export const createAppointmentValidation = [
  body('doctorId').isUUID().withMessage('Valid doctor ID is required'),
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Valid date is required')
    .custom((value) => {
      if (value) {
        const appointmentDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          throw new Error('Appointment date must be in the future');
        }
      }
      return true;
    }),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Valid date is required')
    .custom((value) => {
      if (value) {
        const appointmentDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          throw new Error('Appointment date must be in the future');
        }
      }
      return true;
    }),
  body('appointmentTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Valid time in HH:MM format is required'),
  body('time')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Valid time in HH:MM format is required'),
  body('reason')
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  // Custom validation to ensure at least one date/time field is provided
  body().custom((value, { req }) => {
    if (!req.body.appointmentDate && !req.body.date) {
      throw new Error('Date is required');
    }
    if (!req.body.appointmentTime && !req.body.time) {
      throw new Error('Time is required');
    }
    return true;
  })
];

export const updateAppointmentValidation = [
  body('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'CANCELLED', 'COMPLETED'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];
