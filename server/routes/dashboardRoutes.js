import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import * as operationsController from '../controllers/operationsController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/summary', requireAuth, authorize('admin'), dashboardController.getDashboardSummary);

// Live front-line snapshot for the roles that run the queue (no analytics).
router.get(
  '/operations',
  requireAuth,
  authorize('admin', 'receptionist', 'nurse'),
  operationsController.getOperationsSummary
);

export default router;
