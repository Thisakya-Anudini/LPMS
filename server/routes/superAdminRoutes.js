// server/routes/superAdminRoutes.js
import express from 'express';
import { createUser, getAllUsers, deleteUser } from '../controllers/superAdminController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { requireFields } from '../middlewares/validationMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.post(
  '/',
  protect,
  requireRole([ROLES.SUPER_ADMIN]),
  requireFields(['email', 'password', 'role']),
  createUser
);
router.get('/', protect, requireRole([ROLES.SUPER_ADMIN]), getAllUsers);
router.delete('/:id', protect, requireRole([ROLES.SUPER_ADMIN]), deleteUser);

export default router;
