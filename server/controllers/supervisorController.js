import { query } from '../db.js';
import { logAudit } from '../utils/audit.js';
import { sendError } from '../utils/http.js';

export const getTeam = async (req, res) => {
  const result = await query(
    `
      SELECT e.id, e.employee_number, e.designation, e.grade_name, ap.id AS principal_id, ap.name, ap.email
      FROM employees e
      JOIN auth_principals ap ON ap.id = e.principal_id
      WHERE e.supervisor_id = $1
      ORDER BY ap.name ASC
    `,
    [req.user.id]
  );

  return res.status(200).json({ team: result.rows });
};

export const getTeamProgress = async (req, res) => {
  const result = await query(
    `
      SELECT ap.id AS principal_id, ap.name, ap.email,
             COUNT(en.id) AS total_enrollments,
             COALESCE(AVG(en.progress), 0)::numeric(5,2) AS avg_progress,
             COUNT(*) FILTER (WHERE en.status = 'COMPLETED') AS completed_count
      FROM employees e
      JOIN auth_principals ap ON ap.id = e.principal_id
      LEFT JOIN enrollments en ON en.principal_id = ap.id
      WHERE e.supervisor_id = $1
      GROUP BY ap.id, ap.name, ap.email
      ORDER BY ap.name ASC
    `,
    [req.user.id]
  );

  return res.status(200).json({ progress: result.rows });
};

export const getPendingApprovals = async (req, res) => {
  const result = await query(
    `
      SELECT
        en.id,
        en.approval_status,
        en.status,
        en.progress,
        en.enrolled_at,
        ap.id AS principal_id,
        ap.name,
        ap.email,
        lp.id AS learning_path_id,
        lp.title AS learning_path_title
      FROM enrollments en
      JOIN auth_principals ap ON ap.id = en.principal_id
      JOIN employees e ON e.principal_id = ap.id
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      WHERE e.supervisor_id = $1
      ORDER BY en.enrolled_at DESC
    `,
    [req.user.id]
  );

  return res.status(200).json({ approvals: result.rows });
};

export const getSupervisorPaths = async (_req, res) => {
  const result = await query(
    `
      SELECT id, title, description, category, total_duration, status
      FROM learning_paths
      WHERE is_deleted = FALSE
        AND status = 'ACTIVE'
        AND category = 'SEMI_RESTRICTED'
      ORDER BY created_at DESC
    `
  );

  return res.status(200).json({ learningPaths: result.rows });
};

export const enrollTeamMembers = async (req, res) => {
  const { learningPathId, employeePrincipalIds } = req.body;
  if (!Array.isArray(employeePrincipalIds) || employeePrincipalIds.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeePrincipalIds must be a non-empty array.');
  }

  const pathResult = await query(
    `
      SELECT id, title, category
      FROM learning_paths
      WHERE id = $1 AND is_deleted = FALSE AND status = 'ACTIVE'
      LIMIT 1
    `,
    [learningPathId]
  );
  const path = pathResult.rows[0];
  if (!path) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  if (path.category !== 'SEMI_RESTRICTED') {
    return sendError(res, 403, 'FORBIDDEN', 'Supervisors can only enroll members in semi-restricted paths.');
  }

  const teamResult = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE supervisor_id = $1
    `,
    [req.user.id]
  );
  const teamPrincipalIds = new Set(teamResult.rows.map((row) => row.principal_id));

  const inserted = [];
  for (const principalId of employeePrincipalIds) {
    if (!teamPrincipalIds.has(principalId)) {
      continue;
    }
    const created = await query(
      `
        INSERT INTO enrollments (principal_id, learning_path_id, status, progress, enrolled_at, enrollment_source)
        VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'SUPERVISOR')
        ON CONFLICT (principal_id, learning_path_id) DO NOTHING
        RETURNING id, principal_id, learning_path_id, status, progress, enrolled_at
      `,
      [principalId, learningPathId]
    );
    if (created.rowCount > 0) {
      inserted.push(created.rows[0]);
      await query(
        `
          INSERT INTO notifications (principal_id, title, message, type, is_read)
          VALUES ($1, 'Enrollment Assigned', $2, 'INFO', FALSE)
        `,
        [principalId, `Your supervisor enrolled you in "${path.title}".`]
      );
    }
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'SUPERVISOR_ENROLL_TEAM',
    resourceType: 'ENROLLMENT',
    metadata: { learningPathId, inserted: inserted.length }
  });

  return res.status(201).json({ enrollments: inserted });
};

export const approveEnrollment = async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `
      UPDATE enrollments
      SET approval_status = 'APPROVED', approval_updated_at = NOW(), approval_updated_by = $2
      WHERE id = $1
        AND principal_id IN (
          SELECT e.principal_id
          FROM employees e
          WHERE e.supervisor_id = $2
        )
      RETURNING id, approval_status, approval_updated_at
    `,
    [id, req.user.id]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'APPROVE_ENROLLMENT',
    resourceType: 'ENROLLMENT',
    resourceId: id
  });

  return res.status(200).json({ enrollment: result.rows[0] });
};

export const rejectEnrollment = async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `
      UPDATE enrollments
      SET approval_status = 'REJECTED', approval_updated_at = NOW(), approval_updated_by = $2
      WHERE id = $1
        AND principal_id IN (
          SELECT e.principal_id
          FROM employees e
          WHERE e.supervisor_id = $2
        )
      RETURNING id, approval_status, approval_updated_at
    `,
    [id, req.user.id]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'REJECT_ENROLLMENT',
    resourceType: 'ENROLLMENT',
    resourceId: id
  });

  return res.status(200).json({ enrollment: result.rows[0] });
};
