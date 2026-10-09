import { getKpiMetrics } from "../services/talentDashboard/aggregatesService.js";
import { query } from "../db.js";
import { fetchAllDesignations } from "../utils/erpClient.js";
import { sendError } from "../utils/http.js";

export const getDesignations = async (_req, res) => {
  try {
    // 1. Fetch designations from the employees table
    const dbRes = await query(`
      SELECT DISTINCT designation
      FROM employees
      WHERE designation IS NOT NULL AND TRIM(designation) <> ''
      ORDER BY designation ASC;
    `);

    let designations = dbRes.rows
      .map((r) => String(r.designation || "").trim())
      .filter(Boolean);

    // 2. If ERP is configured in .env, attempt to fetch from ERP
    if (process.env.ERP_DESIGNATIONS_URL) {
      try {
        const erpRes = await fetchAllDesignations();
        if (Array.isArray(erpRes?.data)) {
          const erpList = erpRes.data
            .map((row) =>
              String(row?.designation || row?.designationName || "").trim(),
            )
            .filter(Boolean);
          designations = Array.from(
            new Set([...designations, ...erpList]),
          ).sort((a, b) => a.localeCompare(b));
        }
      } catch (erpErr) {
        console.warn("ERP designations fallback warning:", erpErr.message);
      }
    }

    // 3. Fallback standard company designations if only 1 seed employee exists
    if (designations.length <= 1) {
      const standardDesignations = [
        "Software Engineer",
        "Senior Software Engineer",
        "Tech Lead",
        "Engineering Manager",
        "Product Manager",
        "QA Engineer",
        "UI/UX Designer",
        "HR Executive",
        "Operations Lead",
      ];
      designations = Array.from(
        new Set([...designations, ...standardDesignations]),
      ).sort((a, b) => a.localeCompare(b));
    }

    return res.status(200).json({
      success: true,
      message: "Designations retrieved successfully",
      data: designations,
    });
  } catch (error) {
    console.error("Error in getDesignations controller:", error);
    return sendError(
      res,
      500,
      "DESIGNATIONS_FETCH_FAILED",
      "Failed to retrieve designations.",
    );
  }
};


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

    return res.status(200).json({
      success: true,
      message: "KPI metrics retrieved successfully",
      data: metrics,
    });
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
