import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as roomController from '../controllers/roomController.js';
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
  body('number').trim().notEmpty().withMessage('Room number is required'),
  body('departmentId').notEmpty().withMessage('Department is required'),
  body('status').optional().isIn(['available', 'occupied', 'maintenance']).withMessage('Invalid room status'),
];

const updateRules = [
  body('status').optional().isIn(['available', 'occupied', 'maintenance']).withMessage('Invalid room status'),
];

router.get('/', requireAuth, roomController.listRooms);
router.get('/:id', requireAuth, roomController.getRoom);
router.post('/', requireAuth, authorize('admin'), createRules, validate, roomController.createRoom);
router.put('/:id', requireAuth, authorize('admin'), updateRules, validate, roomController.updateRoom);
router.delete('/:id', requireAuth, authorize('admin'), roomController.deleteRoom);

export default router;
