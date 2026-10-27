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
  callerRole,
  isLearningAdmin = false,
  targetPrincipalId,
  employeeNumber,
  isSelfView = true,
  filters = {},
}) => {
  let resolvedPrincipalId = targetPrincipalId;
  const lookupEmpNo =
    employeeNumber ||
    (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId)
      ? targetPrincipalId.replace(/^erp-learner-/, "")
      : null);

  let ancestorIds = [];
  if (targetPrincipalId && UUID_REGEX.test(targetPrincipalId)) {
    ancestorIds.push(targetPrincipalId);
  }

  if (lookupEmpNo) {
    const princRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1
       UNION
       SELECT id AS principal_id FROM auth_principals WHERE email ILIKE $2;`,
      [lookupEmpNo, `${lookupEmpNo}%`],
    );
    for (const row of princRes.rows) {
      if (row.principal_id && UUID_REGEX.test(row.principal_id)) {
        ancestorIds.push(row.principal_id);
      }
    }
  }

  ancestorIds = Array.from(new Set(ancestorIds));

  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN ||
      callerRole === ROLES.LEARNING_ADMIN ||
      Boolean(isLearningAdmin));

  // Determine if this is a global query (Admin in self view with no direct subordinates)
  // or a scoped supervisor/subordinate query
  let useGlobalOrg = false;
  if (isAdminGlobal) {
    if (ancestorIds.length === 0) {
      useGlobalOrg = true;
    } else {
      // Check if user has any direct reports at depth 1
      const checkRes = await query(
        `SELECT 1 FROM org_hierarchy_closure WHERE ancestor_principal_id = ANY($1::uuid[]) AND depth = 1 LIMIT 1;`,
        [ancestorIds],
      );
      if (checkRes.rowCount === 0) {
        useGlobalOrg = true;
      }
    }
  }

  if (!useGlobalOrg && ancestorIds.length === 0) {
    return [];
  }

  // Parameter index is 1 for global query (no ancestorIds param), 2 for scoped query ($1 is ancestorIds)
  const startIndex = useGlobalOrg ? 1 : 2;
  const { clause, params } = buildFilterConditions(filters, startIndex);

  let sql = "";
  let queryParams = [];

  if (useGlobalOrg) {
    // Global admin view: show all direct reports across the organization
    sql = `
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
      WHERE ohc.depth = 1
      GROUP BY e.employee_number, p.name, e.designation, e.grade_name
      ORDER BY "completedHours" DESC, p.name ASC;
    `;
    queryParams = params;
  } else {
    // Specific supervisor or drilled-down employee view
    sql = `
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
      WHERE ohc.ancestor_principal_id = ANY($1::uuid[]) 
        AND ohc.depth = 1
      GROUP BY e.employee_number, p.name, e.designation, e.grade_name
      ORDER BY "completedHours" DESC, p.name ASC;
    `;
    queryParams = [ancestorIds, ...params];
  }

  const res = await query(sql, queryParams);

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

/**
 * Calculates the top 5 training programs by total completed hours within in-scope hierarchy.
 *
 * @param {Object} options
 * @param {string} options.callerRole
 * @param {boolean} [options.isLearningAdmin=false]
 * @param {string} options.targetPrincipalId
 * @param {string} options.employeeNumber
 * @param {boolean} options.isSelfView
 * @param {Object} options.filters
 * @returns {Promise<Array<{ programId: string, programName: string, participantCount: number, totalCompletedHours: number, percentageOfTop5: number }>>}
 */
export const getTopProgramsData = async ({
  callerRole,
  isLearningAdmin = false,
  targetPrincipalId,
  employeeNumber,
  isSelfView,
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

  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN ||
      callerRole === ROLES.LEARNING_ADMIN ||
      Boolean(isLearningAdmin));

  let rows = [];

  if (isAdminGlobal) {
    // 1. Organization-wide top programs (Super Admin / Learning Admin self view)
    const { clause, params } = buildFilterConditions(filters, 1);
    const sql = `
      WITH top_programs AS (
        SELECT 
          MD5(LOWER(TRIM(tr.program_name))) AS program_id,
          TRIM(tr.program_name) AS program_name,
          COUNT(DISTINCT tr.employee_number)::int AS participant_count,
          COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
        FROM training_records tr
        WHERE 1=1 ${clause}
        GROUP BY TRIM(tr.program_name)
        ORDER BY total_hours DESC
        LIMIT 5
      ),
      top_sum AS (
        SELECT COALESCE(SUM(total_hours), 0) AS grand_top_hours FROM top_programs
      )
      SELECT 
        tp.program_id AS "programId",
        tp.program_name AS "programName",
        tp.participant_count AS "participantCount",
        tp.total_hours AS "totalCompletedHours",
        CASE 
          WHEN ts.grand_top_hours > 0 
          THEN ROUND((tp.total_hours / ts.grand_top_hours) * 100, 1)
          ELSE 0 
        END AS "percentageOfTop5"
      FROM top_programs tp, top_sum ts
      ORDER BY tp.total_hours DESC;
    `;
    const res = await query(sql, params);
    rows = res.rows;
  } else if (isValidUuid) {
    // 2. Supervisor downward hierarchy branch (drill-down view)
    const { clause, params } = buildFilterConditions(filters, 2);
    const sql = `
      WITH top_programs AS (
        SELECT 
          MD5(LOWER(TRIM(tr.program_name))) AS program_id,
          TRIM(tr.program_name) AS program_name,
          COUNT(DISTINCT tr.employee_number)::int AS participant_count,
          COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
        FROM training_records tr
        INNER JOIN org_hierarchy_closure ohc 
          ON tr.principal_id = ohc.descendant_principal_id
        WHERE ohc.ancestor_principal_id = $1 
          AND ohc.depth >= 0
          ${clause}
        GROUP BY TRIM(tr.program_name)
        ORDER BY total_hours DESC
        LIMIT 5
      ),
      top_sum AS (
        SELECT COALESCE(SUM(total_hours), 0) AS grand_top_hours FROM top_programs
      )
      SELECT 
        tp.program_id AS "programId",
        tp.program_name AS "programName",
        tp.participant_count AS "participantCount",
        tp.total_hours AS "totalCompletedHours",
        CASE 
          WHEN ts.grand_top_hours > 0 
          THEN ROUND((tp.total_hours / ts.grand_top_hours) * 100, 1)
          ELSE 0 
        END AS "percentageOfTop5"
      FROM top_programs tp, top_sum ts
      ORDER BY tp.total_hours DESC;
    `;
    const res = await query(sql, [resolvedPrincipalId, ...params]);
    rows = res.rows;
  } else {
    // 3. Individual learner (safely handles UUID vs text employee number)
    const selfField = isValidUuid ? "tr.principal_id" : "tr.employee_number";
    const selfParam = isValidUuid ? resolvedPrincipalId : (lookupEmpNo || resolvedPrincipalId);

    if (selfParam) {
      const { clause, params } = buildFilterConditions(filters, 2);
      const sql = `
        WITH top_programs AS (
          SELECT 
            MD5(LOWER(TRIM(tr.program_name))) AS program_id,
            TRIM(tr.program_name) AS program_name,
            COUNT(DISTINCT tr.employee_number)::int AS participant_count,
            COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
          FROM training_records tr
          WHERE ${selfField} = $1 ${clause}
          GROUP BY TRIM(tr.program_name)
          ORDER BY total_hours DESC
          LIMIT 5
        ),
        top_sum AS (
          SELECT COALESCE(SUM(total_hours), 0) AS grand_top_hours FROM top_programs
        )
        SELECT 
          tp.program_id AS "programId",
          tp.program_name AS "programName",
          tp.participant_count AS "participantCount",
          tp.total_hours AS "totalCompletedHours",
          CASE 
            WHEN ts.grand_top_hours > 0 
            THEN ROUND((tp.total_hours / ts.grand_top_hours) * 100, 1)
            ELSE 0 
          END AS "percentageOfTop5"
        FROM top_programs tp, top_sum ts
        ORDER BY tp.total_hours DESC;
      `;
      const res = await query(sql, [selfParam, ...params]);
      rows = res.rows;
    }
  }


  return rows.map((r) => ({
    programId: String(r.programId || r.programName),
    programName: r.programName,
    participantCount: parseInt(r.participantCount || "0", 10),
    totalCompletedHours: parseFloat(r.totalCompletedHours || "0"),
    percentageOfTop5: parseFloat(r.percentageOfTop5 || "0"),
  }));
};
