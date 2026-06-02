import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  clearAllNotifications
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.patch('/read-all', protect, markAllNotificationsAsRead);
router.delete('/clear-all', protect, clearAllNotifications);
router.patch('/:id/read', protect, markNotificationAsRead);

export default router;

