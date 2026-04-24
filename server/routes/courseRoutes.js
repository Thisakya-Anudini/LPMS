import express from 'express';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';
import { getCourses } from '../controllers/learnerController.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireRole([ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN, ROLES.EMPLOYEE]),
  getCourses
);

export default router;
