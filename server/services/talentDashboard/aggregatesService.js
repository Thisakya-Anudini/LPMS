import { query } from "../../db.js";
import { ROLES } from "../../constants/roles.js";
import { syncHierarchyForUser } from "./hierarchyService.js";

/**
 * Calculates core Talent Development Dashboard KPI metrics
 *
 * @param {Object} params
 * @param {string} params.callerRole - User role (SUPER_ADMIN, SUPERVISOR, etc.)
 * @param {string} params.targetPrincipalId - UUID of the principal in scope
 * @param {string} params.employeeNumber - Employee service number
 * @param {boolean} params.isSelfView - Whether caller is viewing themselves
 * @param {Object} params.filters - { startDate, endDate, trainingType, designation }
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

  const { startDate, endDate, trainingType } = filters;

  // Build filter conditions and parameters for training_records
  const dateConditions = [];
  const queryParams = [targetPrincipalId];
  let paramIndex = 2;

  if (startDate) {
    dateConditions.push(`tr.start_date >= $${paramIndex}`);
    queryParams.push(startDate);
    paramIndex++;
  }
  if (endDate) {
    dateConditions.push(`tr.end_date <= $${paramIndex}`);
    queryParams.push(endDate);
    paramIndex++;
  }
  if (trainingType && trainingType !== "ALL") {
    dateConditions.push(`tr.training_type = $${paramIndex}`);
    queryParams.push(trainingType);
    paramIndex++;
  }

  const filterClause =
    dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";

  // 1. Calculate Total Staff Count
  let totalStaff = 0;
  const isAdminGlobal =
    isSelfView &&
    (callerRole === ROLES.SUPER_ADMIN || callerRole === ROLES.LEARNING_ADMIN);

  if (isAdminGlobal) {
    const staffRes = await query(
      `SELECT COUNT(*)::int AS count FROM employees;`,
    );
    totalStaff = staffRes.rows[0]?.count || 0;
  } else {
    // Count distinct subordinates in closure table (depth > 0)
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
    // Admin sees all records matching filters
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       WHERE 1=1 ${filterClause};`,
      queryParams.slice(1), // exclude targetPrincipalId
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else if (totalStaff > 0) {
    // Supervisor sees all descendants in downward closure tree
    const totalHoursRes = await query(
      `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS total_hours
       FROM training_records tr
       INNER JOIN org_hierarchy_closure ohc 
         ON tr.principal_id = ohc.descendant_principal_id
       WHERE ohc.ancestor_principal_id = $1 
         AND ohc.depth > 0 
         ${filterClause};`,
      queryParams,
    );
    totalTrainingHours = parseFloat(totalHoursRes.rows[0]?.total_hours || "0");
  } else {
    // Standard employee with 0 subordinates: total training hours is 0
    totalTrainingHours = 0;
  }

  // 3. Calculate Self Training Hours (user's personal hours)
  const selfHoursRes = await query(
    `SELECT COALESCE(SUM(tr.duration_hours), 0)::numeric(10, 2) AS self_hours
     FROM training_records tr
     WHERE tr.principal_id = $1 ${filterClause};`,
    queryParams,
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
