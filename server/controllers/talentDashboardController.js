import { getKpiMetrics } from "../services/talentDashboard/aggregatesService.js";
import { sendSuccess, sendError } from "../utils/http.js";

export const getKpis = async (req, res) => {
  try {
    const metrics = await getKpiMetrics({
      callerRole: req.user.role,
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: req.user.employeeNo,
      isSelfView: req.isSelfView,
      filters: {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        trainingType: req.query.trainingType,
        staffCategory: req.query.staffCategory,
        designation: req.query.designation,
      },
    });

    return sendSuccess(res, "KPI metrics retrieved successfully", metrics);
  } catch (error) {
    console.error("Error in getKpis controller:", error);
    return sendError(
      res,
      500,
      "KPI_FETCH_FAILED",
      "Failed to retrieve KPI metrics.",
    );
  }
};
