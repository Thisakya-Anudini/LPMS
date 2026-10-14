import { query } from "../../db.js";
import { ROLES } from "../../constants/roles.js";
import { syncHierarchyForUser } from "./hierarchyService.js";

/**
 * Helper to dynamically build parameterized filter clauses for training_records
 * starting at a specific SQL parameter index.
 */
const buildFilterConditions = (filters = {}, startIndex = 1) => {
  const conditions = [];
  const params = [];
  let index = startIndex;

  if (filters.startDate) {
    conditions.push(`tr.start_date >= $${index}`);
    params.push(filters.startDate);
    index++;
  }
  if (filters.endDate) {
    conditions.push(`tr.end_date <= $${index}`);
    params.push(filters.endDate);
    index++;
  }
  if (filters.trainingType && filters.trainingType !== "ALL") {
    conditions.push(`tr.training_type = $${index}`);
    params.push(filters.trainingType);
    index++;
  }
  if (filters.designation && filters.designation !== "ALL") {
    conditions.push(
      `tr.principal_id IN (SELECT principal_id FROM employees WHERE designation = $${index})`,
    );
    params.push(filters.designation);
    index++;
  }




  const clause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
  return { clause, params };
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calculates core Talent Development Dashboard KPI metrics
 */
export const getKpiMetrics = async ({
  callerRole,
  isLearningAdmin,
  targetPrincipalId,
  employeeNumber,
  isSelfView,
  filters = {},
}) => {
  // 1. If targetPrincipalId is an ERP string (e.g., "erp-learner-008668" or "010402"), attempt to resolve real UUID
  let resolvedPrincipalId = targetPrincipalId;
  const lookupEmpNo =
    employeeNumber ||
    (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId)
      ? targetPrincipalId.replace(/^erp-learner-/, "")
      : null);

  if (
    targetPrincipalId &&
    !UUID_REGEX.test(targetPrincipalId) &&
    lookupEmpNo
  ) {
    const empRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
      [lookupEmpNo],
    );
    if (empRes.rows.length > 0 && empRes.rows[0]?.principal_id) {
      resolvedPrincipalId = empRes.rows[0].principal_id;
    }
  }


  const isValidUuid = Boolean(
    resolvedPrincipalId && UUID_REGEX.test(resolvedPrincipalId),
  );

  // 2. Opportunistic background hierarchy sync if supervisor has a valid UUID
  if (employeeNumber && isValidUuid) {
    try {
      await syncHierarchyForUser(resolvedPrincipalId, employeeNumber);
    } catch {
      // Soft fail: proceed with cached closure data
    }
  }

  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN ||
      callerRole === ROLES.LEARNING_ADMIN ||
      Boolean(isLearningAdmin));

  // 3. Calculate Total Staff Count
  let totalStaff = 0;
  if (isAdminGlobal) {
    const staffRes = await query(
      `SELECT COUNT(*)::int AS count FROM employees;`,
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  } else if (isValidUuid) {
    const staffRes = await query(
      `SELECT COUNT(DISTINCT descendant_principal_id)::int AS count
       FROM org_hierarchy_closure
       WHERE ancestor_principal_id = $1 AND depth > 0;`,
      [resolvedPrincipalId],
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  } else {
    totalStaff = 0;
  }

  // 4. Calculate Total Training Hours (across in-scope staff)
  let totalTrainingHours = 0;

  if (isAdminGlobal) {
    const { clause, params } = buildFilterConditions(filters, 1);
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       WHERE 1=1 ${clause};`,
      params,
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else if (totalStaff > 0 && isValidUuid) {
    const { clause, params } = buildFilterConditions(filters, 2);
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       INNER JOIN org_hierarchy_closure ohc 
         ON tr.principal_id = ohc.descendant_principal_id
       WHERE ohc.ancestor_principal_id = $1 
         AND ohc.depth > 0 
         ${clause};`,
      [resolvedPrincipalId, ...params],
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else {
    totalTrainingHours = 0;
  }

  // 5. Calculate Self Training Hours (user's personal hours)
  // Safely handles both UUID principal_id and text employee_number
  let selfTrainingHours = 0;
  const selfParam = isValidUuid ? resolvedPrincipalId : employeeNumber;
  const selfField = isValidUuid ? "tr.principal_id" : "tr.employee_number";

  if (selfParam) {
    const { clause: selfClause, params: selfParams } = buildFilterConditions(
      filters,
      2,
    );
    const selfHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS self_hours
       FROM training_records tr
       WHERE ${selfField} = $1 ${selfClause};`,
      [selfParam, ...selfParams],
    );
    selfTrainingHours = parseFloat(selfHoursRes.rows[0]?.self_hours || "0");
  }

  // 6. Calculate Average Training Hours
  const averageTrainingHours =
    totalStaff > 0
      ? Math.round((totalTrainingHours / totalStaff) * 10) / 10
      : 0;

  return {
    totalStaff,
    totalTrainingHours,
    averageTrainingHours,
    selfTrainingHours,
    targetHours: 18.0,
  };
};

/**
 * Calculates monthly or yearly training hour trends for the in-scope team.
 *
 * @param {Object} options
 * @param {string} [options.granularity='monthly'] - 'monthly' (YYYY-MM) or 'yearly' (YYYY)
 * @param {string} options.callerRole
 * @param {boolean} [options.isLearningAdmin=false]
 * @param {string} options.targetPrincipalId
 * @param {string} options.employeeNumber
 * @param {boolean} options.isSelfView
 * @param {Object} options.filters
 * @returns {Promise<Array<{ period: string, totalHours: number, averageHours: number }>>}
 */
export const getTrendData = async ({
  granularity = "monthly",
  callerRole,
  isLearningAdmin = false,
  targetPrincipalId,
  employeeNumber,
  isSelfView,
  filters = {},
}) => {
  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN ||
      callerRole === ROLES.LEARNING_ADMIN ||
      Boolean(isLearningAdmin));

  let resolvedPrincipalId = targetPrincipalId;
  const lookupEmpNo =
    employeeNumber ||
    (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId)
      ? targetPrincipalId.replace(/^erp-learner-/, "")
      : null);

  if (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId) && lookupEmpNo) {
    const empRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
      [lookupEmpNo],
    );
    if (empRes.rows.length > 0 && empRes.rows[0]?.principal_id) {
      resolvedPrincipalId = empRes.rows[0].principal_id;
    }
  }

  const isValidUuid = Boolean(
    resolvedPrincipalId && UUID_REGEX.test(resolvedPrincipalId),
  );

  // 1. Get in-scope headcount to compute averages
  let totalStaff = 0;
  if (isAdminGlobal) {
    const staffRes = await query(`SELECT COUNT(*)::int AS count FROM employees;`);
    totalStaff = staffRes.rows[0]?.count || 0;
  } else if (isValidUuid) {
    const staffRes = await query(
      `SELECT COUNT(DISTINCT descendant_principal_id)::int AS count
       FROM org_hierarchy_closure
       WHERE ancestor_principal_id = $1 AND depth > 0;`,
      [resolvedPrincipalId],
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  }

  // 2. Format bucket expression
  const periodExpr =
    granularity === "yearly"
      ? `TO_CHAR(tr.start_date, 'YYYY')`
      : `TO_CHAR(tr.start_date, 'YYYY-MM')`;

  // 3. Query aggregated hours bucketed by period
  let trendRows = [];

  if (isAdminGlobal) {
    const { clause, params } = buildFilterConditions(filters, 1);
    const sql = `
      SELECT 
        ${periodExpr} AS period,
        COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
      FROM training_records tr
      WHERE 1=1 ${clause}
      GROUP BY period
      ORDER BY period ASC;
    `;
    const res = await query(sql, params);
    trendRows = res.rows;
  } else if (isValidUuid && totalStaff > 0) {
    const { clause, params } = buildFilterConditions(filters, 2);
    const sql = `
      SELECT 
        ${periodExpr} AS period,
        COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
      FROM training_records tr
      INNER JOIN org_hierarchy_closure ohc 
        ON tr.principal_id = ohc.descendant_principal_id
      WHERE ohc.ancestor_principal_id = $1 
        AND ohc.depth > 0
        ${clause}
      GROUP BY period
      ORDER BY period ASC;
    `;
    const res = await query(sql, [resolvedPrincipalId, ...params]);
    trendRows = res.rows;
  } else {
    // Individual learner view (own records)
    const selfParam = isValidUuid ? resolvedPrincipalId : lookupEmpNo;
    const selfField = isValidUuid ? "tr.principal_id" : "tr.employee_number";

    if (selfParam) {
      const { clause, params } = buildFilterConditions(filters, 2);
      const sql = `
        SELECT 
          ${periodExpr} AS period,
          COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
        FROM training_records tr
        WHERE ${selfField} = $1 ${clause}
        GROUP BY period
        ORDER BY period ASC;
      `;
      const res = await query(sql, [selfParam, ...params]);
      trendRows = res.rows;
    }
  }

  const divisor = totalStaff > 0 ? totalStaff : 1;

  return trendRows.map((r) => {
    const totalHours = parseFloat(r.total_hours || "0");
    const averageHours = Math.round((totalHours / divisor) * 10) / 10;
    return {
      period: r.period,
      totalHours,
      averageHours,
    };
  });
};

/**
 * Retrieves direct reports (depth = 1) with their completed training hours.
 *
 * @param {Object} options
 * @param {string} options.targetPrincipalId
 * @param {string} options.employeeNumber
 * @param {Object} options.filters
 * @returns {Promise<Array<{ employeeNumber: string, fullName: string, designation: string, department: string, completedHours: number, targetHours: number, completionPercentage: number }>>}
 */
export const getImmediateSubordinates = async ({
  targetPrincipalId,
  employeeNumber,
  filters = {},
}) => {
  let resolvedPrincipalId = targetPrincipalId;
  const lookupEmpNo =
    employeeNumber ||
    (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId)
      ? targetPrincipalId.replace(/^erp-learner-/, "")
      : null);

  if (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId) && lookupEmpNo) {
    const empRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
      [lookupEmpNo],
    );
    if (empRes.rows.length > 0 && empRes.rows[0]?.principal_id) {
      resolvedPrincipalId = empRes.rows[0].principal_id;
    }
  }

  const isValidUuid = Boolean(
    resolvedPrincipalId && UUID_REGEX.test(resolvedPrincipalId),
  );

  if (!isValidUuid) {
    return [];
  }

  const { clause, params } = buildFilterConditions(filters, 2);

  // Query direct subordinates (depth = 1) along with their aggregated completed hours
  const sql = `
    SELECT 
      e.employee_number AS "employeeNumber",
      p.name AS "fullName",
      COALESCE(e.designation, 'Employee') AS "designation",
      COALESCE(e.grade_name, 'General') AS "department",
      COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS "completedHours"
    FROM org_hierarchy_closure ohc
    INNER JOIN auth_principals p 
      ON ohc.descendant_principal_id = p.id
    INNER JOIN employees e 
      ON p.id = e.principal_id
    LEFT JOIN training_records tr 
      ON p.id = tr.principal_id ${clause}
    WHERE ohc.ancestor_principal_id = $1 
      AND ohc.depth = 1
    GROUP BY e.employee_number, p.name, e.designation, e.grade_name
    ORDER BY "completedHours" DESC, p.name ASC;
  `;

  const res = await query(sql, [resolvedPrincipalId, ...params]);

  return res.rows.map((row) => {
    const completedHours = parseFloat(row.completedHours || "0");
    const targetHours = 18.0;
    const completionPercentage = Math.min(
      100,
      Math.round((completedHours / targetHours) * 100),
    );

    return {
      employeeNumber: row.employeeNumber,
      fullName: row.fullName || `Employee ${row.employeeNumber}`,
      designation: row.designation,
      department: row.department,
      completedHours,
      targetHours,
      completionPercentage,
    };
  });
};
