import express from 'express';
import { changePassword, login, logout, me, refresh } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireFields } from '../middlewares/validationMiddleware.js';
import { authRateLimit } from '../middlewares/rateLimitMiddleware.js';

const router = express.Router();

router.post('/login', authRateLimit, requireFields(['email', 'password']), login);
router.post('/refresh', authRateLimit, requireFields(['refreshToken']), refresh);
router.post('/logout', requireFields(['refreshToken']), logout);
router.get('/me', protect, me);
router.put('/change-password', protect, requireFields(['oldPassword', 'newPassword']), changePassword);

export default router;
