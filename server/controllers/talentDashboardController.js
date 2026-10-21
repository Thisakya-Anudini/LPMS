import {
  getKpiMetrics,
  getTrendData,
  getImmediateSubordinates,
} from "../services/talentDashboard/aggregatesService.js";
import {
  getPaginatedTrainingHistory,
  generateTrainingHistoryCsv,
} from "../services/talentDashboard/historyService.js";
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
    const targetEmpNo =
      req.targetEmployeeNumber ||
      (req.isSelfView ? req.user.employeeNo : req.targetPrincipalId);

    const metrics = await getKpiMetrics({
      callerRole: req.user.role,
      isLearningAdmin: Boolean(req.user?.isLearningAdmin),
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: targetEmpNo,
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

export const getTrend = async (req, res) => {
  try {
    const targetEmpNo =
      req.targetEmployeeNumber ||
      (req.isSelfView ? req.user.employeeNo : req.targetPrincipalId);

    const trend = await getTrendData({
      granularity: req.query.granularity === "yearly" ? "yearly" : "monthly",
      callerRole: req.user.role,
      isLearningAdmin: Boolean(req.user?.isLearningAdmin),
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: targetEmpNo,
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
      message: "Trend data retrieved successfully",
      data: trend,
    });
  } catch (error) {
    console.error("Error in getTrend controller:", error);
    return sendError(
      res,
      500,
      "TREND_FETCH_FAILED",
      "Failed to retrieve trend metrics.",
    );
  }
};

export const getSubordinates = async (req, res) => {
  try {
    const targetEmpNo =
      req.targetEmployeeNumber ||
      (req.isSelfView ? req.user.employeeNo : req.targetPrincipalId);

    const subordinates = await getImmediateSubordinates({
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: targetEmpNo,
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
      message: "Immediate subordinates retrieved successfully",
      data: subordinates,
    });
  } catch (error) {
    console.error("Error in getSubordinates controller:", error);
    return sendError(
      res,
      500,
      "SUBORDINATES_FETCH_FAILED",
      "Failed to retrieve immediate subordinates.",
    );
  }
};

export const getHistory = async (req, res) => {
  try {
    const targetEmpNo =
      req.targetEmployeeNumber ||
      (req.isSelfView ? req.user.employeeNo : req.targetPrincipalId);

    const result = await getPaginatedTrainingHistory({
      callerRole: req.user.role,
      isLearningAdmin: Boolean(req.user?.isLearningAdmin),
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: targetEmpNo,
      isSelfView: req.isSelfView,
      filters: {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        trainingType: req.query.trainingType,
        staffCategory: req.query.staffCategory,
        designation: req.query.designation,
        search: req.query.search,
      },
      page: req.query.page,
      pageSize: req.query.pageSize,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Training history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getHistory controller:", error);
    return sendError(
      res,
      500,
      "HISTORY_FETCH_FAILED",
      "Failed to retrieve training history.",
    );
  }
};

export const exportHistory = async (req, res) => {
  try {
    const targetEmpNo =
      req.targetEmployeeNumber ||
      (req.isSelfView ? req.user.employeeNo : req.targetPrincipalId);

    const csvData = await generateTrainingHistoryCsv({
      callerRole: req.user.role,
      isLearningAdmin: Boolean(req.user?.isLearningAdmin),
      targetPrincipalId: req.targetPrincipalId,
      employeeNumber: targetEmpNo,
      isSelfView: req.isSelfView,
      filters: {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        trainingType: req.query.trainingType,
        staffCategory: req.query.staffCategory,
        designation: req.query.designation,
        search: req.query.search,
      },
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `talent_training_history_${dateStamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  } catch (error) {
    console.error("Error in exportHistory controller:", error);
    return sendError(
      res,
      500,
      "HISTORY_EXPORT_FAILED",
      "Failed to export training history.",
    );
  }
};
