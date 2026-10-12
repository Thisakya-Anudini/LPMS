import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { ROLES } from "../constants/roles.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether the logged-in caller has permission to view data
 * for the requested target principal (either themselves or a subordinate).
 *
 * Attaches:
 * - req.targetPrincipalId: The resolved UUID to query data for.
 * - req.isSelfView: Boolean indicating if caller is viewing themselves.
 */
export const verifyTalentScope = async (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, "AUTH_REQUIRED", "Authentication is required.");
  }

  const callerId = req.user.id;
  const callerRole = req.user.role;
  const requestedTargetId =
    req.query.viewAsId || req.params.principalId || null;

  // 1. Viewing self (default when no viewAsId is specified or matches caller ID)
  if (!requestedTargetId || requestedTargetId === callerId) {
    req.targetPrincipalId = callerId;
    req.isSelfView = true;
    return next();
  }

  const isGlobalAdmin =
    callerRole === ROLES.SUPER_ADMIN ||
    callerRole === ROLES.LEARNING_ADMIN ||
    Boolean(req.user?.isLearningAdmin);

  // Resolve target if passed as an employee number (e.g., "EMP-1001", "008668", or "010402")
  let resolvedTargetId = requestedTargetId;
  let targetEmployeeNumber = null;

  if (requestedTargetId && !UUID_REGEX.test(requestedTargetId)) {
    targetEmployeeNumber = requestedTargetId;
    const empRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
      [requestedTargetId],
    );
    if (empRes.rows.length > 0 && empRes.rows[0].principal_id) {
      resolvedTargetId = empRes.rows[0].principal_id;
    }
  }

  // 2. Super Admins & Learning Admins have global organization visibility
  if (isGlobalAdmin) {
    // Admins can inspect any UUID or valid employee service number from ERP
    if (
      !UUID_REGEX.test(resolvedTargetId) &&
      !/^[A-Za-z0-9_-]{2,30}$/.test(resolvedTargetId)
    ) {
      return sendError(
        res,
        400,
        "INVALID_TARGET_IDENTIFIER",
        "The provided viewAsId is not a valid identifier.",
      );
    }

    req.targetPrincipalId = resolvedTargetId;
    req.targetEmployeeNumber = targetEmployeeNumber;
    req.isSelfView = false;
    return next();
  }

  // Validate UUID format for regular supervisors before hierarchy closure lookup
  if (resolvedTargetId && !UUID_REGEX.test(resolvedTargetId)) {
    return sendError(
      res,
      400,
      "INVALID_UUID",
      "The provided viewAsId is not a valid UUID format or known employee number.",
    );
  }



  // Resolve caller principal ID if caller has temporary ERP ID
  let effectiveCallerId = callerId;
  if (!UUID_REGEX.test(callerId) && req.user.employeeNo) {
    const callerEmpRes = await query(
      `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
      [req.user.employeeNo],
    );
    if (callerEmpRes.rows.length > 0 && callerEmpRes.rows[0].principal_id) {
      effectiveCallerId = callerEmpRes.rows[0].principal_id;
    }
  }

  // 3. For Supervisors and Employees: verify descendant in org_hierarchy_closure
  try {
    const checkQuery = `
      SELECT depth 
      FROM org_hierarchy_closure 
      WHERE ancestor_principal_id = $1 
        AND descendant_principal_id = $2
      LIMIT 1;
    `;
    const result = await query(checkQuery, [
      effectiveCallerId,
      resolvedTargetId,
    ]);

    if (result.rows.length === 0) {
      return sendError(
        res,
        403,
        "FORBIDDEN_SCOPE",
        "Access Denied: You do not have permission to view training data for this employee.",
      );
    }

    req.targetPrincipalId = resolvedTargetId;
    req.drillDownDepth = result.rows[0].depth;
    req.isSelfView = false;
    return next();
  } catch (error) {
    console.error("Error verifying talent scope:", error);
    return sendError(
      res,
      500,
      "SCOPE_VERIFICATION_FAILED",
      "An error occurred while verifying access permissions.",
    );
  }
};

