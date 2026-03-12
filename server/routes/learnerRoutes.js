import express from 'express';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
  downloadLearnerCertificate,
  enrollLearnerTeam,
  getLearnerCertificates,
  getLearnerDashboard,
  getLearnerPathCourses,
  getPublicLearningPaths,
  getLearningPaths,
  getLearnerProfile,
  getLearnerTeam,
  getPublicLearningPathById,
  selfEnrollPublicLearningPath,
  updateLearnerCourseCompletion
} from '../controllers/learnerController.js';
import { requireFields } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.get('/profile', protect, requireRole([ROLES.EMPLOYEE]), getLearnerProfile);
router.get('/dashboard', protect, requireRole([ROLES.EMPLOYEE]), getLearnerDashboard);
router.get('/certificates', protect, requireRole([ROLES.EMPLOYEE]), getLearnerCertificates);
router.get('/certificates/:certificateId/download', protect, requireRole([ROLES.EMPLOYEE]), downloadLearnerCertificate);
router.get('/learning-paths', protect, requireRole([ROLES.EMPLOYEE]), getLearningPaths);
router.get('/my-paths/:enrollmentId/courses', protect, requireRole([ROLES.EMPLOYEE]), getLearnerPathCourses);
router.put(
  '/my-paths/:enrollmentId/courses/:courseId',
  protect,
  requireRole([ROLES.EMPLOYEE]),
  requireFields(['completed']),
  updateLearnerCourseCompletion
);
router.get('/public-paths', protect, requireRole([ROLES.EMPLOYEE]), getPublicLearningPaths);
router.get('/public-paths/:id', protect, requireRole([ROLES.EMPLOYEE]), getPublicLearningPathById);
router.get('/team', protect, requireRole([ROLES.EMPLOYEE]), getLearnerTeam);
router.post(
  '/self-enroll',
  protect,
  requireRole([ROLES.EMPLOYEE]),
  requireFields(['learningPathId']),
  selfEnrollPublicLearningPath
);
router.post(
  '/team/enroll',
  protect,
  requireRole([ROLES.EMPLOYEE]),
  requireFields(['employeeNumbers', 'learningPathIds']),
  enrollLearnerTeam
);

export default router;
