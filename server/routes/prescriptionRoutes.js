import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as prescriptionController from '../controllers/prescriptionController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const itemRules = [
  body('items').isArray({ min: 1 }).withMessage('At least one medicine is required'),
  body('items.*.medicineName').notEmpty().withMessage('Each medicine needs a name'),
  body('items.*.dosage').notEmpty().withMessage('Each medicine needs a dosage'),
];

const createRules = [body('consultationId').notEmpty().withMessage('consultationId is required'), ...itemRules];

// Any authenticated role can view prescriptions (doctors are scoped to
// their own in the controller - same pattern as consultations).
router.get('/', requireAuth, prescriptionController.listPrescriptions);
router.get('/:id', requireAuth, prescriptionController.getPrescription);

// Only doctors write prescriptions - it's their clinical order.
router.post('/', requireAuth, authorize('doctor'), createRules, validate, prescriptionController.createPrescription);
router.put('/:id', requireAuth, authorize('doctor'), itemRules, validate, prescriptionController.updatePrescription);

export default router;
