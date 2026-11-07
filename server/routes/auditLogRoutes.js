import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// Viewing audit logs is an admin capability per the master spec's role list.
router.get('/', requireAuth, authorize('admin'), auditLogController.listAuditLogs);
router.get('/filter-options', requireAuth, authorize('admin'), auditLogController.listFilterOptions);

export default router;
