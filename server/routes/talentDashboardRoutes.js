import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { verifyTalentScope } from "../middlewares/scopeMiddleware.js";
import {
    getKpis,
    getDesignations,
} from "../controllers/talentDashboardController.js";

const router = Router();

// Protect all talent dashboard routes with JWT authentication
router.use(protect);

// GET /api/talent-dashboard/designations (Dynamic master list)
router.get("/designations", getDesignations);

// GET /api/talent-dashboard/kpis
router.get("/kpis", verifyTalentScope, getKpis);

export default router;
