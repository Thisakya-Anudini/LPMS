import express from 'express';
import {
  approveEnrollment,
  enrollTeamMembers,
  getSupervisorPaths,
  getPendingApprovals,
  getTeam,
  getTeamProgress,
  rejectEnrollment
} from '../controllers/supervisorController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.get('/team', protect, requireRole([ROLES.SUPERVISOR]), getTeam);
router.get('/team/progress', protect, requireRole([ROLES.SUPERVISOR]), getTeamProgress);
router.get('/approvals', protect, requireRole([ROLES.SUPERVISOR]), getPendingApprovals);
router.get('/paths', protect, requireRole([ROLES.SUPERVISOR]), getSupervisorPaths);
router.post('/enrollments', protect, requireRole([ROLES.SUPERVISOR]), enrollTeamMembers);
router.post('/approvals/:id/approve', protect, requireRole([ROLES.SUPERVISOR]), approveEnrollment);
router.post('/approvals/:id/reject', protect, requireRole([ROLES.SUPERVISOR]), rejectEnrollment);

export default router;
