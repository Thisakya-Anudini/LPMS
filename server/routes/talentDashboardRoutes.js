import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { verifyTalentScope } from "../middlewares/scopeMiddleware.js";
import { getKpis } from "../controllers/talentDashboardController.js";

const router = Router();

// Protect all talent dashboard routes with JWT authentication
router.use(protect);

// GET /api/talent-dashboard/kpis
// Accepts optional query params: ?viewAsId=<uuid>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&trainingType=ALL
router.get("/kpis", verifyTalentScope, getKpis);

export default router;
