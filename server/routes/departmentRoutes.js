import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as departmentController from '../controllers/departmentController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 400, errors.array()));
  next();
}

const rules = [body('name').trim().notEmpty().withMessage('Department name is required')];

router.get('/', requireAuth, departmentController.listDepartments);
router.get('/:id', requireAuth, departmentController.getDepartment);
router.post('/', requireAuth, authorize('admin'), rules, validate, departmentController.createDepartment);
router.put('/:id', requireAuth, authorize('admin'), rules, validate, departmentController.updateDepartment);
router.delete('/:id', requireAuth, authorize('admin'), departmentController.deactivateDepartment);

export default router;
