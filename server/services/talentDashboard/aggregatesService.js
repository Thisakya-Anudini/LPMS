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

/**
 * Calculates core Talent Development Dashboard KPI metrics
 */
export const getKpiMetrics = async ({
  callerRole,
  targetPrincipalId,
  employeeNumber,
  isSelfView,
  filters = {},
}) => {
  // 1. Opportunistic background hierarchy sync if supervisor has employee number
  if (employeeNumber && targetPrincipalId) {
    try {
      await syncHierarchyForUser(targetPrincipalId, employeeNumber);
    } catch {
      // Soft fail: proceed with cached closure data
    }
  }

  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN || callerRole === ROLES.LEARNING_ADMIN);

  // 1. Calculate Total Staff Count
  let totalStaff = 0;
  if (isAdminGlobal) {
    const staffRes = await query(
      `SELECT COUNT(*)::int AS count FROM employees;`,
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  } else {
    const staffRes = await query(
      `SELECT COUNT(DISTINCT descendant_principal_id)::int AS count
       FROM org_hierarchy_closure
       WHERE ancestor_principal_id = $1 AND depth > 0;`,
      [targetPrincipalId],
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  }

  // 2. Calculate Total Training Hours (across all in-scope staff)
  let totalTrainingHours = 0;

  if (isAdminGlobal) {
    // Admin query: parameters start at $1
    const { clause, params } = buildFilterConditions(filters, 1);
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       WHERE 1=1 ${clause};`,
      params,
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else if (totalStaff > 0) {
    // Scoped supervisor query: $1 is targetPrincipalId, filters start at $2
    const { clause, params } = buildFilterConditions(filters, 2);
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       INNER JOIN org_hierarchy_closure ohc 
         ON tr.principal_id = ohc.descendant_principal_id
       WHERE ohc.ancestor_principal_id = $1 
         AND ohc.depth > 0 
         ${clause};`,
      [targetPrincipalId, ...params],
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else {
    totalTrainingHours = 0;
  }

  // 3. Calculate Self Training Hours (user's personal hours)
  // $1 is targetPrincipalId, filters start at $2
  const { clause: selfClause, params: selfParams } = buildFilterConditions(
    filters,
    2,
  );
  const selfHoursRes = await query(
    `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS self_hours
     FROM training_records tr
     WHERE tr.principal_id = $1 ${selfClause};`,
    [targetPrincipalId, ...selfParams],
  );
  const selfTrainingHours = parseFloat(selfHoursRes.rows[0]?.self_hours || "0");

  // 4. Calculate Average Training Hours
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
