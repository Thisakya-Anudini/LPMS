import { query } from "../../db.js";
import { fetchEmployeeSubordinates } from "../../utils/erpClient.js";

/**
 * Synchronizes reporting hierarchy from the external ERP into the local
 * org_hierarchy_closure table for high-speed dashboard queries.
 *
 * @param {string} principalId - UUID of the supervisor in auth_principals
 * @param {string} employeeNumber - Employee service number (e.g., "EMP001")
 * @returns {Promise<{ synced: boolean, directSubordinatesCount: number }>}
 */
export const syncHierarchyForUser = async (principalId, employeeNumber) => {
  if (!principalId || !employeeNumber) {
    return { synced: false, directSubordinatesCount: 0 };
  }

  // 1. Ensure self-reference exists (depth = 0)
  await query(
    `INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
     VALUES ($1, $1, 0)
     ON CONFLICT (ancestor_principal_id, descendant_principal_id) DO NOTHING;`,
    [principalId],
  );

  try {
    // 2. Fetch direct subordinates from ERP
    const erpResponse = await fetchEmployeeSubordinates(employeeNumber);
    const subordinatesList = Array.isArray(erpResponse?.data)
      ? erpResponse.data
      : Array.isArray(erpResponse)
        ? erpResponse
        : [];

    if (subordinatesList.length === 0) {
      return { synced: true, directSubordinatesCount: 0 };
    }

    // Extract employee numbers from ERP response
    const subordinateEmpNumbers = subordinatesList
      .map((sub) => String(sub.employeeNo || sub.employeeNumber || "").trim())
      .filter(Boolean);

    if (subordinateEmpNumbers.length === 0) {
      return { synced: true, directSubordinatesCount: 0 };
    }

    // 3. Find matching principal_ids in our local employees table
    const matchedEmployeesRes = await query(
      `SELECT principal_id, employee_number 
       FROM employees 
       WHERE employee_number = ANY($1::text[]);`,
      [subordinateEmpNumbers],
    );

    const matchedPrincipals = matchedEmployeesRes.rows;

    // 4. Upsert direct subordinates into org_hierarchy_closure with depth = 1
    for (const sub of matchedPrincipals) {
      await query(
        `INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (ancestor_principal_id, descendant_principal_id) 
         DO UPDATE SET depth = 1, updated_at = NOW();`,
        [principalId, sub.principal_id],
      );
    }

    return {
      synced: true,
      directSubordinatesCount: matchedPrincipals.length,
    };
  } catch (error) {
    // ERP Resilience: Log warning and proceed with cached local data
    console.warn(
      `[HierarchySync] ERP sync skipped for ${employeeNumber} (${error.message}). Using local cache.`,
    );

    // Check existing count in cache
    const cachedCountRes = await query(
      `SELECT COUNT(*)::int AS count 
       FROM org_hierarchy_closure 
       WHERE ancestor_principal_id = $1 AND depth = 1;`,
      [principalId],
    );

    return {
      synced: false,
      directSubordinatesCount: cachedCountRes.rows[0]?.count || 0,
    };
  }
};

/**
 * Returns all direct and indirect subordinates for a given principal
 * from the cached closure table.
 */
export const getSubordinatesFromClosure = async (
  principalId,
  directOnly = false,
) => {
  const depthFilter = directOnly ? "AND ohc.depth = 1" : "AND ohc.depth > 0";

  const sql = `
    SELECT 
      e.principal_id,
      e.employee_number,
      ap.name AS full_name,
      e.designation,
      e.grade_name,
      ohc.depth
    FROM org_hierarchy_closure ohc
    INNER JOIN employees e ON ohc.descendant_principal_id = e.principal_id
    INNER JOIN auth_principals ap ON e.principal_id = ap.id
    WHERE ohc.ancestor_principal_id = $1 ${depthFilter}
    ORDER BY ohc.depth ASC, ap.name ASC;
  `;

  const result = await query(sql, [principalId]);
  return result.rows;
};
