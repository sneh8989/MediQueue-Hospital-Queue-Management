import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as consultationController from '../controllers/consultationController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const createRules = [
  body('queueEntryId').notEmpty().withMessage('queueEntryId is required'),
  body('chiefComplaint').optional().isString(),
  body('symptoms').optional().isString(),
  body('diagnosis').optional().isString(),
  body('notes').optional().isString(),
  body('followUpDate').optional({ values: 'falsy' }).isISO8601().withMessage('followUpDate must be a valid date'),
];

const updateRules = [
  body('followUpDate').optional({ values: 'falsy' }).isISO8601().withMessage('followUpDate must be a valid date'),
  body('completeConsultation').optional().isBoolean(),
];

// Any authenticated staff can view consultation history (doctors are
// scoped to their own in the controller; nurses/admin/reception may need
// read access for coordinating care, matching the pattern used for
// appointments and queue entries elsewhere in this API).
router.get('/', requireAuth, consultationController.listConsultations);
router.get('/:id', requireAuth, consultationController.getConsultation);

// Only doctors create/edit consultations - it's their clinical record.
router.post('/', requireAuth, authorize('doctor'), createRules, validate, consultationController.createConsultation);
router.put('/:id', requireAuth, authorize('doctor'), updateRules, validate, consultationController.updateConsultation);

export default router;
