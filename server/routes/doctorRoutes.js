import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as doctorController from '../controllers/doctorController.js';
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
  body('name').trim().notEmpty().withMessage('Doctor name is required'),
  body('departmentId').notEmpty().withMessage('Department is required'),
  body('email')
    .if(body('userId').not().exists())
    .isEmail()
    .withMessage('A valid email is required when creating a new doctor login'),
  body('password')
    .if(body('userId').not().exists())
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('avgConsultationMinutes')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Average consultation minutes must be between 1 and 180'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Doctor name cannot be empty'),
  body('avgConsultationMinutes')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Average consultation minutes must be between 1 and 180'),
];

router.get('/', requireAuth, doctorController.listDoctors);
router.get('/me', requireAuth, authorize('doctor'), doctorController.getMyDoctorProfile);
router.get('/:id', requireAuth, doctorController.getDoctor);
router.post('/', requireAuth, authorize('admin'), createRules, validate, doctorController.createDoctor);
router.put('/:id', requireAuth, authorize('admin'), updateRules, validate, doctorController.updateDoctor);
router.delete('/:id', requireAuth, authorize('admin'), doctorController.deactivateDoctor);

export default router;
