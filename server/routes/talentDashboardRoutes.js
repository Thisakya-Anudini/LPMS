import { Router } from "express";
import { protect, requireRole } from "../middlewares/authMiddleware.js";
import { ROLES } from "../constants/roles.js";
import { verifyTalentScope } from "../middlewares/scopeMiddleware.js";
import {
    getKpis,
    getDesignations,
    getTrend,
    getSubordinates,
    getHistory,
    exportHistory,
    getTopPrograms,
    getTargetSettingsController,
    updateTargetSettingsController,
} from "../controllers/talentDashboardController.js";

const router = Router();

// Protect all talent dashboard routes with JWT authentication
router.use(protect);

// GET /api/talent-dashboard/designations (Dynamic master list)
router.get("/designations", getDesignations);

// GET /api/talent-dashboard/kpis
router.get("/kpis", verifyTalentScope, getKpis);

// GET /api/talent-dashboard/trend
router.get("/trend", verifyTalentScope, getTrend);

// GET /api/talent-dashboard/immediate-subordinates
router.get("/immediate-subordinates", verifyTalentScope, getSubordinates);

// GET /api/talent-dashboard/top-programs
router.get("/top-programs", verifyTalentScope, getTopPrograms);

// GET /api/talent-dashboard/history
router.get("/history", verifyTalentScope, getHistory);

// GET /api/talent-dashboard/history/export
router.get("/history/export", verifyTalentScope, exportHistory);

// GET /api/talent-dashboard/settings/target (Read-only for all authenticated users)
router.get("/settings/target", getTargetSettingsController);

// PUT /api/talent-dashboard/settings/target (Gated strictly to SUPER_ADMIN)
router.put(
    "/settings/target",
    requireRole([ROLES.SUPER_ADMIN]),
    updateTargetSettingsController
);

export default router;
