import { query } from '../db.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';
import { getMockCourseById } from '../utils/mockLearningStore.js';

const parseCategory = (value) => {
  const allowed = ['RESTRICTED', 'SEMI_RESTRICTED', 'PUBLIC'];
  if (!allowed.includes(value)) {
    return null;
  }
  return value;
};

const isStructuredStagePayload = (stages) =>
  Array.isArray(stages) && stages.some((stage) => Array.isArray(stage?.courses));

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveActorPrincipalId = async (user) => {
  const directId = String(user?.id || '').trim();
  if (UUID_LIKE.test(directId)) {
    return directId;
  }

  const employeeNo = String(user?.employeeNo || '').trim();
  if (!employeeNo) {
    return null;
  }

  const mapped = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNo]
  );

  return mapped.rows[0]?.principal_id || null;
};

const resolveCourseUuid = async (courseId) => {
  const raw = String(courseId || '').trim();
  if (!raw) {
    return null;
  }

  if (UUID_LIKE.test(raw)) {
    return raw;
  }

  const mockCourse = getMockCourseById(raw);
  if (!mockCourse) {
    return null;
  }

  const code = `MOCK_${mockCourse.id.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const existing = await query(
    `
      SELECT id
      FROM courses
      WHERE code = $1
      LIMIT 1
    `,
    [code]
  );
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const created = await query(
    `
      INSERT INTO courses (code, title, description, duration, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      code,
      mockCourse.title,
      mockCourse.description || `${mockCourse.title} (mock catalog course)`,
      `${mockCourse.durationHours || 2} hours`,
      mockCourse.deliveryMode === 'ONLINE' ? 'ONLINE' : 'CLASSROOM'
    ]
  );

  return created.rows[0].id;
};

const insertLearningPathStages = async ({ learningPathId, stages = [] }) => {
  if (!Array.isArray(stages) || stages.length === 0) {
    return;
  }

  if (!isStructuredStagePayload(stages)) {
    for (const stage of stages) {
      await query(
        `
          INSERT INTO learning_path_stages (learning_path_id, title, stage_order)
          VALUES ($1, $2, $3)
        `,
        [learningPathId, stage.title, stage.order]
      );
    }
    return;
  }

  for (const [stageIndex, stage] of stages.entries()) {
    const createdStage = await query(
      `
        INSERT INTO learning_path_stages (learning_path_id, title, stage_order)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [learningPathId, stage.title, stage.order || stageIndex + 1]
    );
    const stageId = createdStage.rows[0].id;
    const stageCourses = Array.isArray(stage.courses) ? stage.courses : [];

    for (const [courseIndex, stageCourse] of stageCourses.entries()) {
      if (!stageCourse?.courseId) {
        continue;
      }
      const resolvedCourseId = await resolveCourseUuid(stageCourse.courseId);
      if (!resolvedCourseId) {
        continue;
      }
      await query(
        `
          INSERT INTO stage_courses (stage_id, course_id, course_order)
          VALUES ($1, $2, $3)
        `,
        [stageId, resolvedCourseId, stageCourse.order || courseIndex + 1]
      );
    }
  }
};

export const createLearningPath = async (req, res) => {
  const {
    title,
    description,
    category,
    totalDuration,
    stages = [],
    certificateSignerName = null,
    certificateSignerTitle = null
  } = req.body;
  const normalizedCategory = parseCategory(category);
  if (!normalizedCategory) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid category.');
  }

  const actorPrincipalId = await resolveActorPrincipalId(req.user);

  const pathResult = await query(
    `
      INSERT INTO learning_paths (
        title, description, category, total_duration, status, created_by, certificate_signer_name, certificate_signer_title
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7)
      RETURNING
        id, title, description, category, total_duration, status, created_at,
        certificate_signer_name, certificate_signer_title
    `,
    [
      title,
      description,
      normalizedCategory,
      totalDuration,
      actorPrincipalId,
      certificateSignerName,
      certificateSignerTitle
    ]
  );

  const learningPath = pathResult.rows[0];

  await insertLearningPathStages({ learningPathId: learningPath.id, stages });

  await logAudit({
    actorPrincipalId,
    action: 'CREATE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: learningPath.id
  });

  return res.status(201).json({ learningPath });
};

export const getLearningPaths = async (_req, res) => {
  const result = await query(
    `
      SELECT
        id,
        title,
        description,
        category,
        total_duration,
        status,
        created_at,
        certificate_signer_name,
        certificate_signer_title
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
           , certificate_signer_name, certificate_signer_title
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

  const stageCourseResult = await query(
    `
      SELECT
        lps.id AS stage_id,
        c.id AS course_id,
        c.title AS course_title,
        sc.course_order,
        CASE
          WHEN c.type = 'ONLINE' THEN 'ONLINE'
          ELSE 'PHYSICAL'
        END AS delivery_mode
      FROM learning_path_stages lps
      JOIN stage_courses sc ON sc.stage_id = lps.id
      JOIN courses c ON c.id = sc.course_id
      WHERE lps.learning_path_id = $1
      ORDER BY lps.stage_order ASC, sc.course_order ASC
    `,
    [id]
  );

  const stageCoursesByStageId = new Map();
  for (const row of stageCourseResult.rows) {
    if (!stageCoursesByStageId.has(row.stage_id)) {
      stageCoursesByStageId.set(row.stage_id, []);
    }
    stageCoursesByStageId.get(row.stage_id).push({
      course_id: row.course_id,
      title: row.course_title,
      course_order: Number(row.course_order),
      delivery_mode: row.delivery_mode
    });
  }

  const structuredStages = stageResult.rows.map((stageRow) => ({
    ...stageRow,
    courses: stageCoursesByStageId.get(stageRow.id) || []
  }));

  return res.status(200).json({
    learningPath: {
      ...learningPath,
      stages: structuredStages
    }
  });
};

export const updateLearningPath = async (req, res) => {
  const { id } = req.params;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
  const {
    title,
    description,
    category,
    totalDuration,
    status,
    stages,
    certificateSignerName,
    certificateSignerTitle
  } = req.body;

  const result = await query(
    `
      UPDATE learning_paths
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          category = COALESCE($4, category),
          total_duration = COALESCE($5, total_duration),
          status = COALESCE($6, status),
          certificate_signer_name = COALESCE($7, certificate_signer_name),
          certificate_signer_title = COALESCE($8, certificate_signer_title),
          updated_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING
        id, title, description, category, total_duration, status, updated_at,
        certificate_signer_name, certificate_signer_title
    `,
    [
      id,
      title,
      description,
      category || null,
      totalDuration,
      status,
      certificateSignerName ?? null,
      certificateSignerTitle ?? null
    ]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  if (Array.isArray(stages)) {
    await query('DELETE FROM learning_path_stages WHERE learning_path_id = $1', [id]);
    await insertLearningPathStages({ learningPathId: id, stages });
  }

  await logAudit({
    actorPrincipalId,
    action: 'UPDATE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: id
  });

  return res.status(200).json({ learningPath: result.rows[0] });
};

export const getCertificateCustomizationPaths = async (_req, res) => {
  const result = await query(
    `
      SELECT
        id,
        title,
        certificate_signer_name,
        certificate_signer_title,
        updated_at
      FROM learning_paths
      WHERE is_deleted = FALSE
      ORDER BY title ASC
    `
  );

  return res.status(200).json({ learningPaths: result.rows });
};

export const updateLearningPathCertificateSignature = async (req, res) => {
  const { id } = req.params;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
  const signerName = String(req.body.signerName || '').trim();
  const signerTitle = String(req.body.signerTitle || '').trim();

  if (!signerName || !signerTitle) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'signerName and signerTitle are required.');
  }

  const result = await query(
    `
      UPDATE learning_paths
      SET certificate_signer_name = $2,
          certificate_signer_title = $3,
          updated_at = NOW()
      WHERE id = $1
        AND is_deleted = FALSE
      RETURNING id, title, certificate_signer_name, certificate_signer_title, updated_at
    `,
    [id, signerName, signerTitle]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  await logAudit({
    actorPrincipalId,
    action: 'UPDATE_CERTIFICATE_SIGNATURE',
    resourceType: 'LEARNING_PATH',
    resourceId: id,
    metadata: { signerName, signerTitle }
  });

  return res.status(200).json({ learningPath: result.rows[0] });
};

export const deleteLearningPath = async (req, res) => {
  const { id } = req.params;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
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
    actorPrincipalId,
    action: 'DELETE_LEARNING_PATH',
    resourceType: 'LEARNING_PATH',
    resourceId: id
  });

  return res.status(200).json({ success: true });
};

export const createEnrollments = async (req, res) => {
  const { learningPathId, employeePrincipalIds } = req.body;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
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
    actorPrincipalId,
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
