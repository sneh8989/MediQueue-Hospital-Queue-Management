import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as patientController from '../controllers/patientController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }
  next();
}

const patientValidationRules = [
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 7, max: 20 })
    .withMessage('Phone number looks invalid'),
  body('dob').optional({ values: 'falsy' }).isISO8601().withMessage('Date of birth must be a valid date'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email looks invalid'),
  body('bloodGroup')
    .optional({ values: 'falsy' })
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Blood group must be a valid type'),
];

// All authenticated staff can view patients.
router.get('/', requireAuth, patientController.listPatients);
router.get('/:id', requireAuth, patientController.getPatient);

// Only receptionist and admin can register / edit patients.
router.post(
  '/',
  requireAuth,
  authorize('admin', 'receptionist'),
  patientValidationRules,
  validate,
  patientController.createPatient
);

router.put(
  '/:id',
  requireAuth,
  authorize('admin', 'receptionist'),
  patientValidationRules,
  validate,
  patientController.updatePatient
);

export default router;
