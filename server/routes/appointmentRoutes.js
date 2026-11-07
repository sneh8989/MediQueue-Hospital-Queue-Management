import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as appointmentController from '../controllers/appointmentController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const STATUS_VALUES = ['scheduled', 'confirmed', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'];

const createRules = [
  body('patientId').notEmpty().withMessage('Patient is required'),
  body('doctorId').notEmpty().withMessage('Doctor is required'),
  body('departmentId').notEmpty().withMessage('Department is required'),
  body('date').isISO8601().withMessage('A valid date is required'),
  body('timeSlot')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Time slot must be in HH:mm format'),
];

const updateRules = [
  body('date').optional().isISO8601().withMessage('A valid date is required'),
  body('timeSlot')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Time slot must be in HH:mm format'),
  body('status').optional().isIn(STATUS_VALUES).withMessage('Invalid status'),
];

// Any authenticated role can view (receptionists book, doctors see their
// own queue, nurses/admin oversee). listAppointments/todayAppointments
// scope doctors to their own records server-side.
router.get('/', requireAuth, appointmentController.listAppointments);
router.get('/today', requireAuth, appointmentController.todayAppointments);
router.get('/:id', requireAuth, appointmentController.getAppointment);

router.post(
  '/',
  requireAuth,
  authorize('admin', 'receptionist'),
  createRules,
  validate,
  appointmentController.createAppointment
);

// Admin/receptionist can fully edit; doctors can update status/notes on
// their own appointments (enforced inside the controller, since it needs
// to compare against the existing record).
router.put(
  '/:id',
  requireAuth,
  authorize('admin', 'receptionist', 'doctor'),
  updateRules,
  validate,
  appointmentController.updateAppointment
);

export default router;
