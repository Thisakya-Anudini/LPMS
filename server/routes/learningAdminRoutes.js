import express from 'express';
import {
  assignClassEnrollments,
  createEnrollments,
  createLearningPath,
  deleteLearningPath,
  getAssignmentReports,
  getAssignableEmployeeSearchOptions,
  getClassesByCourseCode,
  getClassAssignmentOptions,
  getCertificateCustomizationPaths,
  getLearningSummaryReport,
  getLearningPathById,
  getLearningPaths,
  previewLearningPathCertificate,
  searchAssignableEmployees,
  updateAssignmentReportStatus,
  updateLearningPathCertificateSignature,
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
router.get('/learning-paths', protect, requireRole([ROLES.LEARNING_ADMIN, ROLES.SUPER_ADMIN]), getLearningPaths);
router.get(
  '/learning-paths/:id/class-assignment-options',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  getClassAssignmentOptions
);
router.get('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN, ROLES.SUPER_ADMIN]), getLearningPathById);
router.put('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN]), updateLearningPath);
router.delete('/learning-paths/:id', protect, requireRole([ROLES.LEARNING_ADMIN]), deleteLearningPath);
router.get('/courses/:courseCode/classes', protect, requireRole([ROLES.LEARNING_ADMIN]), getClassesByCourseCode);

router.post(
  '/enrollments',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['learningPathId', 'selectedLearners']),
  createEnrollments
);
router.post(
  '/class-enrollments',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['learningPathId', 'courseCode', 'class', 'enrollmentIds']),
  assignClassEnrollments
);
router.get('/assignment-reports', protect, requireRole([ROLES.LEARNING_ADMIN]), getAssignmentReports);
router.patch(
  '/assignment-reports/:id/status',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['status']),
  updateAssignmentReportStatus
);
router.get(
  '/employee-search-options',
  protect,
  requireRole([ROLES.LEARNING_ADMIN, ROLES.SUPER_ADMIN]),
  getAssignableEmployeeSearchOptions
);
router.post(
  '/employee-search',
  protect,
  requireRole([ROLES.LEARNING_ADMIN, ROLES.SUPER_ADMIN]),
  searchAssignableEmployees
);
router.get('/reports/summary', protect, requireRole([ROLES.LEARNING_ADMIN]), getLearningSummaryReport);
router.get('/certificate-settings', protect, requireRole([ROLES.LEARNING_ADMIN]), getCertificateCustomizationPaths);
router.put(
  '/learning-paths/:id/certificate-signature',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  requireFields(['signerName', 'signerTitle']),
  updateLearningPathCertificateSignature
);
router.post(
  '/learning-paths/:id/certificate-preview',
  protect,
  requireRole([ROLES.LEARNING_ADMIN]),
  previewLearningPathCertificate
);

export default router;
