import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getMyNotifications);
router.get('/my', getMyNotifications); // Alias for frontend compatibility
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead); // Frontend uses PATCH
router.post('/mark-all-read', markAllAsRead); // Keep POST for backwards compat
router.delete('/:id', deleteNotification);

export default router;
