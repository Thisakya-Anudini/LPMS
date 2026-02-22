import express from 'express';
import {
  getPublicPaths,
  getMyCertificates,
  getMyPaths,
  getMyProgress,
  getNotifications,
  selfEnrollPublicPath,
  updateMyEnrollmentProgress
} from '../controllers/employeeController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';
import { requireFields } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.get('/my-paths', protect, requireRole([ROLES.EMPLOYEE]), getMyPaths);
router.get('/public-paths', protect, requireRole([ROLES.EMPLOYEE]), getPublicPaths);
router.get('/my-progress', protect, requireRole([ROLES.EMPLOYEE]), getMyProgress);
router.get('/notifications', protect, requireRole([ROLES.EMPLOYEE]), getNotifications);
router.get('/certificates', protect, requireRole([ROLES.EMPLOYEE]), getMyCertificates);
router.put('/my-paths/:enrollmentId/progress', protect, requireRole([ROLES.EMPLOYEE]), updateMyEnrollmentProgress);
router.post('/self-enroll', protect, requireRole([ROLES.EMPLOYEE]), requireFields(['learningPathId']), selfEnrollPublicPath);

export default router;
