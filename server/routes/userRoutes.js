import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as userController from '../controllers/userController.js';
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
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'receptionist', 'nurse']).withMessage('Role must be admin, receptionist, or nurse'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('role').optional().isIn(['admin', 'receptionist', 'nurse']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
];

const resetPasswordRules = [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')];

// All staff management is admin-only, per the master spec's role list.
router.get('/', requireAuth, authorize('admin'), userController.listUsers);
router.get('/:id', requireAuth, authorize('admin'), userController.getUser);
router.post('/', requireAuth, authorize('admin'), createRules, validate, userController.createUser);
router.put('/:id', requireAuth, authorize('admin'), updateRules, validate, userController.updateUser);
router.put(
  '/:id/reset-password',
  requireAuth,
  authorize('admin'),
  resetPasswordRules,
  validate,
  userController.resetPassword
);

export default router;
