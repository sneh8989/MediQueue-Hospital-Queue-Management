import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Every authenticated staff role can read/manage their own notifications
// (no role restriction needed - the controller scopes everything to
// req.user.sub, so there's nothing here to authorize by role).
router.get('/', requireAuth, notificationController.listMyNotifications);
router.get('/unread-count', requireAuth, notificationController.getUnreadCount);
router.put('/:id/read', requireAuth, notificationController.markAsRead);
router.put('/read-all', requireAuth, notificationController.markAllAsRead);

export default router;
