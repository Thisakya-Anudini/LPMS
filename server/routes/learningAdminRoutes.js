import express from 'express';
import {
  createEnrollments,
  createLearningPath,
  deleteLearningPath,
  getAssignableEmployees,
  getLearningSummaryReport,
  getLearningPathById,
  getLearningPaths,
  updateLearningPath
} from '../controllers/learningAdminController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { requireFields } from '../middlewares/validationMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.post(
  '/learning-paths',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['title', 'description', 'category', 'totalDuration']),
  createLearningPath
);
router.get('/learning-paths', protect, requireRole([ROLES.LEARNING_ADMIN]), getLearningPaths);
router.get('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN]), getLearningPathById);
router.put('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN]), updateLearningPath);
router.delete('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN]), deleteLearningPath);

router.post(
  '/enrollments',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['learningPathId', 'employeePrincipalIds']),
  createEnrollments
);
router.get('/employees', protect, requireRole([ROLES.LEARNING_ADMIN]), getAssignableEmployees);
router.get('/reports/summary', protect, requireRole([ROLES.LEARNING_ADMIN]), getLearningSummaryReport);

export default router;
