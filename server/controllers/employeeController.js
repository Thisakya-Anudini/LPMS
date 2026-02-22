import { query } from '../db.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';

export const getMyPaths = async (req, res) => {
  const result = await query(
    `
      SELECT en.id, en.status, en.progress, en.enrolled_at, en.completed_at,
             lp.id AS learning_path_id, lp.title, lp.description, lp.category, lp.total_duration
      FROM enrollments en
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      WHERE en.principal_id = $1 AND lp.is_deleted = FALSE
      ORDER BY en.enrolled_at DESC
    `,
    [req.user.id]
  );

  return res.status(200).json({ enrollments: result.rows });
};

export const getPublicPaths = async (req, res) => {
  const result = await query(
    `
      SELECT lp.id, lp.title, lp.description, lp.category, lp.total_duration, lp.status,
             CASE WHEN en.id IS NULL THEN FALSE ELSE TRUE END AS already_enrolled
      FROM learning_paths lp
      LEFT JOIN enrollments en
        ON en.learning_path_id = lp.id
       AND en.principal_id = $1
      WHERE lp.is_deleted = FALSE
        AND lp.status = 'ACTIVE'
        AND lp.category = 'PUBLIC'
      ORDER BY lp.created_at DESC
    `,
    [req.user.id]
  );

  return res.status(200).json({ learningPaths: result.rows });
};

export const getMyProgress = async (req, res) => {
  const result = await query(
    `
      SELECT
        COUNT(*) AS total_enrollments,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_enrollments,
        COALESCE(AVG(progress), 0)::numeric(5,2) AS average_progress
      FROM enrollments
      WHERE principal_id = $1
    `,
    [req.user.id]
  );

  return res.status(200).json({ progress: result.rows[0] });
};

export const getNotifications = async (req, res) => {
  const result = await query(
    `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE principal_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [req.user.id]
  );

  return res.status(200).json({ notifications: result.rows });
};

export const getMyCertificates = async (req, res) => {
  const result = await query(
    `
      SELECT c.id, c.scope, c.issued_at, lp.id AS learning_path_id, lp.title AS learning_path_title
      FROM certificates c
      JOIN learning_paths lp ON lp.id = c.learning_path_id
      WHERE c.principal_id = $1
      ORDER BY c.issued_at DESC
    `,
    [req.user.id]
  );

  return res.status(200).json({ certificates: result.rows });
};

export const updateMyEnrollmentProgress = async (req, res) => {
  const { enrollmentId } = req.params;
  const { progress } = req.body;

  if (typeof progress !== 'number' || Number.isNaN(progress) || progress < 0 || progress > 100) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'progress must be a number between 0 and 100.');
  }

  const normalizedStatus = progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

  const result = await query(
    `
      UPDATE enrollments
      SET progress = $3,
          status = $4,
          completed_at = CASE WHEN $3 >= 100 THEN NOW() ELSE NULL END
      WHERE id = $1
        AND principal_id = $2
      RETURNING id, status, progress, completed_at
    `,
    [enrollmentId, req.user.id, progress, normalizedStatus]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'UPDATE_ENROLLMENT_PROGRESS',
    resourceType: 'ENROLLMENT',
    resourceId: enrollmentId,
    metadata: { progress, status: normalizedStatus }
  });

  if (progress >= 100) {
    await query(
      `
        INSERT INTO certificates (principal_id, learning_path_id, scope, issued_by)
        SELECT en.principal_id, en.learning_path_id, 'FULL', $2
        FROM enrollments en
        WHERE en.id = $1
        ON CONFLICT (principal_id, learning_path_id, scope) DO NOTHING
      `,
      [enrollmentId, req.user.id]
    );

    await query(
      `
        INSERT INTO notifications (principal_id, title, message, type, is_read)
        SELECT en.principal_id, 'Certificate Issued',
               'Congratulations! Your full learning path certificate has been issued.',
               'SUCCESS', FALSE
        FROM enrollments en
        WHERE en.id = $1
      `,
      [enrollmentId]
    );
  }

  return res.status(200).json({ enrollment: result.rows[0] });
};

export const selfEnrollPublicPath = async (req, res) => {
  const { learningPathId } = req.body;
  const pathResult = await query(
    `
      SELECT id, title, category, status
      FROM learning_paths
      WHERE id = $1 AND is_deleted = FALSE
      LIMIT 1
    `,
    [learningPathId]
  );
  const path = pathResult.rows[0];
  if (!path) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }
  if (path.status !== 'ACTIVE' || path.category !== 'PUBLIC') {
    return sendError(res, 403, 'FORBIDDEN', 'This learning path is not open for self-enrollment.');
  }

  const created = await query(
    `
      INSERT INTO enrollments (principal_id, learning_path_id, status, progress, enrolled_at, enrollment_source)
      VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'SELF')
      ON CONFLICT (principal_id, learning_path_id) DO NOTHING
      RETURNING id, principal_id, learning_path_id, status, progress, enrolled_at
    `,
    [req.user.id, learningPathId]
  );

  if (created.rowCount === 0) {
    return sendError(res, 409, 'CONFLICT', 'You are already enrolled in this learning path.');
  }

  await query(
    `
      INSERT INTO notifications (principal_id, title, message, type, is_read)
      VALUES ($1, 'Self Enrollment Confirmed', $2, 'SUCCESS', FALSE)
    `,
    [req.user.id, `You have enrolled in "${path.title}".`]
  );

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'SELF_ENROLL_PUBLIC_PATH',
    resourceType: 'ENROLLMENT',
    resourceId: created.rows[0].id,
    metadata: { learningPathId }
  });

  return res.status(201).json({ enrollment: created.rows[0] });
};
