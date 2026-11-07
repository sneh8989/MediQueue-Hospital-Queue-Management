import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as queueController from '../controllers/queueController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const PRIORITY_VALUES = ['emergency', 'senior_citizen', 'pregnant', 'special_needs', 'normal'];

const tokenRules = [
  body('appointmentId').optional().notEmpty(),
  body('patientId').if(body('appointmentId').not().exists()).notEmpty().withMessage('Patient is required for a walk-in token'),
  body('departmentId').if(body('appointmentId').not().exists()).notEmpty().withMessage('Department is required for a walk-in token'),
  body('doctorId').if(body('appointmentId').not().exists()).notEmpty().withMessage('Doctor is required for a walk-in token'),
  body('priority').optional().isIn(PRIORITY_VALUES).withMessage('Invalid priority level'),
];

// Front-desk/clinical roles manage the queue day-to-day; admin oversees.
const QUEUE_MANAGERS = ['admin', 'receptionist', 'nurse', 'doctor'];

router.get('/', requireAuth, queueController.getQueue);
router.get('/history', requireAuth, queueController.getPatientQueueHistory);
router.get('/:id', requireAuth, queueController.getQueueEntry);

router.post('/token', requireAuth, authorize(...QUEUE_MANAGERS), tokenRules, validate, queueController.generateToken);

router.post('/call-next', requireAuth, authorize(...QUEUE_MANAGERS), queueController.callNext);
router.post('/:id/call', requireAuth, authorize(...QUEUE_MANAGERS), queueController.callSpecific);
router.post('/:id/skip', requireAuth, authorize(...QUEUE_MANAGERS), queueController.skip);
router.post('/:id/recall', requireAuth, authorize(...QUEUE_MANAGERS), queueController.recall);
router.post('/:id/start', requireAuth, authorize(...QUEUE_MANAGERS), queueController.start);
router.post('/:id/complete', requireAuth, authorize(...QUEUE_MANAGERS), queueController.complete);
router.post('/:id/cancel', requireAuth, authorize(...QUEUE_MANAGERS), queueController.cancel);
router.post('/:id/no-show', requireAuth, authorize(...QUEUE_MANAGERS), queueController.markNoShow);

export default router;
