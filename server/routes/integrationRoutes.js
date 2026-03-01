import express from 'express';
import {
  getErpHierarchy,
  getErpLearnerDetails,
  getErpSubordinates,
  importErpEmployees
} from '../controllers/integrationController.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';
import { requireFields } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.post(
  '/erp/learner-details',
  protect,
  requireRole([ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN, ROLES.EMPLOYEE]),
  requireFields(['employeeNo']),
  getErpLearnerDetails
);
router.post(
  '/erp/subordinates',
  protect,
  requireRole([ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN, ROLES.EMPLOYEE]),
  requireFields(['employeeNo']),
  getErpSubordinates
);
router.post(
  '/erp/hierarchy',
  protect,
  requireRole([ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN]),
  requireFields(['employeeNo']),
  getErpHierarchy
);
router.post(
  '/erp/import-employees',
  protect,
  requireRole([ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN]),
  requireFields(['employees']),
  importErpEmployees
);

export default router;
