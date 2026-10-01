import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { ROLES } from "../constants/roles.js";

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
  // Support viewAsId passed via query string or route parameter
  const requestedTargetId =
    req.query.viewAsId || req.params.principalId || null;

  // 1. Viewing self (default when no viewAsId is specified or matches caller ID)
  if (!requestedTargetId || requestedTargetId === callerId) {
    req.targetPrincipalId = callerId;
    req.isSelfView = true;
    return next();
  }

  // 2. Super Admins & Learning Admins have global organization visibility
  if (callerRole === ROLES.SUPER_ADMIN || callerRole === ROLES.LEARNING_ADMIN) {
    req.targetPrincipalId = requestedTargetId;
    req.isSelfView = false;
    return next();
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
    const result = await query(checkQuery, [callerId, requestedTargetId]);

    if (result.rows.length === 0) {
      return sendError(
        res,
        403,
        "FORBIDDEN_SCOPE",
        "Access Denied: You do not have permission to view training data for this employee.",
      );
    }

    req.targetPrincipalId = requestedTargetId;
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
