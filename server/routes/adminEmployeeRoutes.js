import express from 'express';
import { createEmployee } from '../controllers/superAdminController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { requireFields } from '../middlewares/validationMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.post(
  '/',
  protect,
  requireRole([ROLES.SUPER_ADMIN]),
  requireFields(['employeeNumber', 'email', 'password', 'designation', 'gradeName']),
  createEmployee
);

export default router;
