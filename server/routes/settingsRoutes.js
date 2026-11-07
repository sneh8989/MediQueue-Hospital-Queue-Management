import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const updateRules = [
  body('averageConsultationMinutes')
    .notEmpty()
    .withMessage('Default consultation time is required')
    .bail()
    .isInt({ min: 1, max: 120 })
    .withMessage('Default consultation time must be a whole number of minutes between 1 and 120')
    .toInt(),
];

// Settings are hospital-wide configuration - admin only, read and write.
router.get('/', requireAuth, authorize('admin'), settingsController.getSettings);
router.put('/', requireAuth, authorize('admin'), updateRules, validate, settingsController.updateSettings);

export default router;
