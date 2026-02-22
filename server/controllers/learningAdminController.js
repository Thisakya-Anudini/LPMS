import { query } from '../db.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';

const parseCategory = (value) => {
  const allowed = ['RESTRICTED', 'SEMI_RESTRICTED', 'PUBLIC'];
  if (!allowed.includes(value)) {
    return null;
  }
  return value;
};

export const createLearningPath = async (req, res) => {
  const { title, description, category, totalDuration, stages = [] } = req.body;
  const normalizedCategory = parseCategory(category);
  if (!normalizedCategory) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid category.');
  }

  const pathResult = await query(
    `
      INSERT INTO learning_paths (title, description, category, total_duration, status, created_by)
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
      RETURNING id, title, description, category, total_duration, status, created_at
    `,
    [title, description, normalizedCategory, totalDuration, req.user.id]
  );

  const learningPath = pathResult.rows[0];

  for (const stage of stages) {
    await query(
      `
        INSERT INTO learning_path_stages (learning_path_id, title, stage_order)
        VALUES ($1, $2, $3)
      `,
      [learningPath.id, stage.title, stage.order]
    );
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'CREATE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: learningPath.id
  });

  return res.status(201).json({ learningPath });
};

export const getLearningPaths = async (_req, res) => {
  const result = await query(
    `
      SELECT id, title, description, category, total_duration, status, created_at
      FROM learning_paths
      WHERE is_deleted = FALSE
      ORDER BY created_at DESC
    `
  );

  return res.status(200).json({ learningPaths: result.rows });
};

export const getLearningPathById = async (req, res) => {
  const { id } = req.params;
  const pathResult = await query(
    `
      SELECT id, title, description, category, total_duration, status, created_at
      FROM learning_paths
      WHERE id = $1 AND is_deleted = FALSE
      LIMIT 1
    `,
    [id]
  );

  const learningPath = pathResult.rows[0];
  if (!learningPath) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  const stageResult = await query(
    `
      SELECT id, title, stage_order
      FROM learning_path_stages
      WHERE learning_path_id = $1
      ORDER BY stage_order ASC
    `,
    [id]
  );

  return res.status(200).json({
    learningPath: {
      ...learningPath,
      stages: stageResult.rows
    }
  });
};

export const updateLearningPath = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, totalDuration, status } = req.body;

  const result = await query(
    `
      UPDATE learning_paths
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          category = COALESCE($4, category),
          total_duration = COALESCE($5, total_duration),
          status = COALESCE($6, status),
          updated_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id, title, description, category, total_duration, status, updated_at
    `,
    [id, title, description, category || null, totalDuration, status]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'UPDATE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: id
  });

  return res.status(200).json({ learningPath: result.rows[0] });
};

export const deleteLearningPath = async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `
      UPDATE learning_paths
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'DELETE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: id
  });

  return res.status(200).json({ success: true });
};

export const createEnrollments = async (req, res) => {
  const { learningPathId, employeePrincipalIds } = req.body;
  if (!Array.isArray(employeePrincipalIds) || employeePrincipalIds.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeePrincipalIds must be a non-empty array.');
  }

  const inserted = [];

  const pathResult = await query(
    `
      SELECT id, title, category
      FROM learning_paths
      WHERE id = $1 AND is_deleted = FALSE
      LIMIT 1
    `,
    [learningPathId]
  );
  const learningPath = pathResult.rows[0];
  if (!learningPath) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  for (const principalId of employeePrincipalIds) {
    const created = await query(
      `
        INSERT INTO enrollments (principal_id, learning_path_id, status, progress, enrolled_at, enrollment_source)
        VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'LEARNING_ADMIN')
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
        [principalId, `You were enrolled in "${learningPath.title}".`]
      );
    }
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'CREATE_ENROLLMENTS',
    resourceType: 'ENROLLMENT',
    metadata: { learningPathId, inserted: inserted.length }
  });

  return res.status(201).json({ enrollments: inserted });
};

export const getAssignableEmployees = async (_req, res) => {
  const result = await query(
    `
      SELECT ap.id, ap.name, ap.email, e.employee_number, e.designation, e.grade_name
      FROM auth_principals ap
      JOIN employees e ON e.principal_id = ap.id
      WHERE ap.role = 'EMPLOYEE' AND ap.is_active = TRUE
      ORDER BY ap.name ASC
    `
  );

  return res.status(200).json({ employees: result.rows });
};

export const getLearningSummaryReport = async (_req, res) => {
  const totals = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE is_deleted = FALSE) AS total_paths,
        COUNT(*) FILTER (WHERE is_deleted = FALSE AND status = 'ACTIVE') AS active_paths
      FROM learning_paths
    `
  );

  const enrollments = await query(
    `
      SELECT
        COUNT(*) AS total_enrollments,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_enrollments
      FROM enrollments
    `
  );

  const certificates = await query(
    `
      SELECT COUNT(*) AS total_certificates
      FROM certificates
    `
  );

  const totalEnrollments = Number(enrollments.rows[0].total_enrollments || 0);
  const completedEnrollments = Number(enrollments.rows[0].completed_enrollments || 0);
  const completionRate = totalEnrollments === 0 ? 0 : Math.round((completedEnrollments / totalEnrollments) * 100);

  return res.status(200).json({
    summary: {
      totalPaths: Number(totals.rows[0].total_paths || 0),
      activePaths: Number(totals.rows[0].active_paths || 0),
      totalEnrollments,
      completedEnrollments,
      completionRate,
      totalCertificates: Number(certificates.rows[0].total_certificates || 0)
    }
  });
};
