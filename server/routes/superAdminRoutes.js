// server/routes/superAdminRoutes.js
import express from 'express';
import {
  createUser,
  getAllUsers,
  deleteUser,
  getAllLearners,
  getLearnerLearningPaths,
  getLearningPathEnrollments,
  assignLearningAdmin,
  removeLearningAdmin
} from '../controllers/superAdminController.js';
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
router.get('/learners', protect, requireRole([ROLES.SUPER_ADMIN]), getAllLearners);
router.get('/learners/:principalId/learning-paths', protect, requireRole([ROLES.SUPER_ADMIN]), getLearnerLearningPaths);
router.get('/learning-paths/:learningPathId/enrollments', protect, requireRole([ROLES.SUPER_ADMIN]), getLearningPathEnrollments);
router.post(
  '/learning-admin-assignments',
  protect,
  requireRole([ROLES.SUPER_ADMIN]),
  requireFields(['employeeNumber']),
  assignLearningAdmin
);
router.delete(
  '/learning-admin-assignments/:employeeNumber',
  protect,
  requireRole([ROLES.SUPER_ADMIN]),
  removeLearningAdmin
);
router.delete('/:id', protect, requireRole([ROLES.SUPER_ADMIN]), deleteUser);

export default router;
