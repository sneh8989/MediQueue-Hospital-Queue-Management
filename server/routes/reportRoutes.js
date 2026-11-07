import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// Reports are an admin capability per the master spec's role list
// (section 3: "View reports" is listed under Admin only).
router.get('/types', requireAuth, authorize('admin'), reportController.listReportTypes);
router.get('/:type', requireAuth, authorize('admin'), reportController.getReport);

export default router;
