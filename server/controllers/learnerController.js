import { sendError } from '../utils/http.js';
import { getMockCourseByTitle, getMockCourseVideoUrlByTitle, MOCK_COURSES } from '../utils/mockLearningStore.js';
import bcrypt from 'bcryptjs';
import {
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeeSubordinates
} from '../utils/erpClient.js';
import { query } from '../db.js';
import { sendLearningPathCompletionEmail } from '../utils/mailer.js';
import sharp from 'sharp';

const removeImageBackground = async (base64DataUri) => {
  try {
    const base64Data = base64DataUri.includes(',')
      ? base64DataUri.split(',')[1]
      : base64DataUri;

    const inputBuffer = Buffer.from(base64Data, 'base64');

    const { data, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixels = new Uint8Array(data);

    const samplePixel = (x, y) => {
      const idx = (y * width + x) * channels;
      return { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] };
    };

    const corners = [
      samplePixel(0, 0),
      samplePixel(width - 1, 0),
      samplePixel(0, height - 1),
      samplePixel(width - 1, height - 1),
    ];

    const bgColor = {
      r: Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length),
      g: Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length),
      b: Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length),
    };

    const TOLERANCE = 30;

    const colorDiff = (r, g, b) =>
      Math.sqrt(
        Math.pow(r - bgColor.r, 2) +
        Math.pow(g - bgColor.g, 2) +
        Math.pow(b - bgColor.b, 2)
      );

    for (let i = 0; i < pixels.length; i += channels) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (colorDiff(r, g, b) <= TOLERANCE) {
        pixels[i + 3] = 0;
      }
    }

    const outputBuffer = await sharp(Buffer.from(pixels), {
      raw: { width, height, channels },
    })
      .png()
      .toBuffer();

    return `data:image/png;base64,${outputBuffer.toString('base64')}`;
  } catch (err) {
    console.warn('Background removal failed, using original:', err.message);
    return base64DataUri;
  }
};

const normalizeEmployeeNo = (user, requestBody = {}) => {
  if (user.employeeNo) {
    return String(user.employeeNo).trim();
  }
  if (requestBody.employeeNo && typeof requestBody.employeeNo === 'string') {
    return requestBody.employeeNo.trim();
  }
  return '';
};

const isSupervisorFromSubordinateResponse = (response) =>
  Boolean(Array.isArray(response?.data) && response.data.length > 0);

const resolveDashboardPrincipalId = async (user, employeeNo) => {
  if (user.authSource !== 'MOCK_LEARNER') {
    return user.id;
  }
  const result = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNo]
  );
  return result.rows[0]?.principal_id || null;
};

const resolvePrincipalForLearner = async (user, employeeNo) => {
  if (user.authSource !== 'MOCK_LEARNER') {
    return user.id;
  }
  return resolveDashboardPrincipalId(user, employeeNo);
};

const recalculateEnrollmentFromStageProgress = async ({
  enrollmentId,
  learningPathId,
  principalId
}) => {
  const aggregate = await query(
    `
      WITH scoped_courses AS (
        SELECT sc.course_id AS activity_id
        FROM learning_path_stages lps
        JOIN stage_courses sc ON sc.stage_id = lps.id
        WHERE lps.learning_path_id = $2
        UNION ALL
        SELECT lps.id AS activity_id
        FROM learning_path_stages lps
        WHERE lps.learning_path_id = $2
          AND NOT EXISTS (
            SELECT 1
            FROM stage_courses sc2
            JOIN learning_path_stages lps2 ON lps2.id = sc2.stage_id
            WHERE lps2.learning_path_id = $2
          )
      )
      SELECT
        COUNT(*)::int AS total_courses,
        COUNT(*) FILTER (WHERE COALESCE(ep.progress, 0) >= 100)::int AS completed_courses
      FROM scoped_courses sc
      LEFT JOIN enrollment_progress ep
        ON ep.enrollment_id = $1
       AND (ep.course_id = sc.activity_id OR ep.stage_id = sc.activity_id)
    `,
    [enrollmentId, learningPathId]
  );

  const totalCourses = Number(aggregate.rows[0]?.total_courses || 0);
  const completedCourses = Number(aggregate.rows[0]?.completed_courses || 0);
  const computedProgress =
    totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
  const status =
    computedProgress >= 100 ? 'COMPLETED' : computedProgress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

  const updatedEnrollment = await query(
    `
      UPDATE enrollments
      SET progress = $2,
          status = $3,
          completed_at = CASE WHEN $2 >= 100 THEN NOW() ELSE NULL END
      WHERE id = $1
        AND principal_id = $4
      RETURNING id, learning_path_id, progress, status, completed_at
    `,
    [enrollmentId, computedProgress, status, principalId]
  );

  return {
    enrollment: updatedEnrollment.rows[0],
    totalCourses,
    completedCourses,
    computedProgress
  };
};

const normalizeNameFromRow = (row, employeeNo) => {
  if (row?.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }
  const initials = row?.employeeInitials ? String(row.employeeInitials).trim() : '';
  const surname = row?.employeeSurname ? String(row.employeeSurname).trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || `Learner ${employeeNo}`;
};

const getOrCreateLearnerPrincipal = async ({
  employeeNo,
  profileRow = null,
  defaultDesignation = 'Learner',
  defaultGradeName = 'N/A',
  supervisorPrincipalId = null
}) => {
  const employeeNumber = String(employeeNo).trim();
  if (!employeeNumber) {
    return null;
  }

  const existingEmployee = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNumber]
  );
  if (existingEmployee.rowCount > 0) {
    return existingEmployee.rows[0].principal_id;
  }

  const fallbackDomain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || 'erp.local';
  const email = (
    (profileRow?.email ? String(profileRow.email).trim().toLowerCase() : '') ||
    `${employeeNumber}@${fallbackDomain}`
  );
  const name = normalizeNameFromRow(profileRow, employeeNumber);
  const designation = profileRow?.designation
    ? String(profileRow.designation).trim()
    : defaultDesignation;
  const gradeName = profileRow?.gradeName ? String(profileRow.gradeName).trim() : defaultGradeName;

  let principalId = null;
  const existingPrincipal = await query(
    `
      SELECT id
      FROM auth_principals
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );
  if (existingPrincipal.rowCount > 0) {
    principalId = existingPrincipal.rows[0].id;
  } else {
    const passwordHash = await bcrypt.hash(employeeNumber, 10);
    const createdPrincipal = await query(
      `
        INSERT INTO auth_principals (email, password_hash, role, name, principal_type, must_change_password)
        VALUES ($1, $2, 'EMPLOYEE', $3, 'EMPLOYEE', FALSE)
        RETURNING id
      `,
      [email, passwordHash, name]
    );
    principalId = createdPrincipal.rows[0].id;
  }

  await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_number) DO NOTHING
    `,
    [principalId, employeeNumber, designation || 'Learner', gradeName || 'N/A', supervisorPrincipalId]
  );

  return principalId;
};

export const getLearnerProfile = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  try {
    const [detailsResponse, subordinatesResponse] = await Promise.all([
      fetchEmployeeDetailsForServiceNo(employeeNo),
      fetchEmployeeSubordinates(employeeNo)
    ]);

    return res.status(200).json({
      profile: detailsResponse?.data?.[0] || null,
      isSupervisor: isSupervisorFromSubordinateResponse(subordinatesResponse)
    });
  } catch (error) {
    return sendError(
      res,
      typeof error.status === 'number' ? error.status : 502,
      'ERP_REQUEST_FAILED',
      'Failed to fetch learner profile from ERP.',
      error.details || error.message
    );
  }
};

export const getLearnerDashboard = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const principalId = await resolveDashboardPrincipalId(req.user, employeeNo);
  if (!principalId) {
    return res.status(200).json({
      assignedLearningPaths: [],
      summary: {
        totalLearningPaths: 0,
        completedLearningPaths: 0,
        averageProgress: 0
      },
      notifications: [
        {
          id: 'mock-dashboard-info',
          title: 'No LPMS records yet',
          message:
            'This learner is authenticated by mock ERP credentials but is not yet imported into LPMS.',
          type: 'INFO'
        }
      ]
    });
  }

  const pathsResult = await query(
    `
      SELECT
        en.id AS enrollment_id,
        en.learning_path_id,
        lp.title,
        en.progress,
        en.status
      FROM enrollments en
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      WHERE en.principal_id = $1
        AND lp.is_deleted = FALSE
      ORDER BY en.enrolled_at DESC
    `,
    [principalId]
  );

  const notificationsResult = await query(
    `
      SELECT id, title, message, type
      FROM notifications
      WHERE principal_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
    [principalId]
  );

  const assignedLearningPaths = pathsResult.rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    learningPathId: row.learning_path_id,
    title: row.title,
    progress: Number(row.progress || 0),
    status: row.status
  }));

  const completedCount = assignedLearningPaths.filter((row) => row.status === 'COMPLETED').length;
  const averageProgress =
    assignedLearningPaths.length > 0
      ? Math.round(
        assignedLearningPaths.reduce((sum, row) => sum + Number(row.progress || 0), 0) /
            assignedLearningPaths.length
      )
      : 0;

  return res.status(200).json({
    assignedLearningPaths,
    summary: {
      totalLearningPaths: assignedLearningPaths.length,
      completedLearningPaths: completedCount,
      averageProgress
    },
    notifications: notificationsResult.rows
  });
};

export const getLearnerTeam = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  try {
    const subordinates = await fetchEmployeeSubordinates(employeeNo);
    return res.status(200).json({
      employeeNo,
      isSupervisor: isSupervisorFromSubordinateResponse(subordinates),
      team: subordinates?.data || []
    });
  } catch (error) {
    return sendError(
      res,
      typeof error.status === 'number' ? error.status : 502,
      'ERP_REQUEST_FAILED',
      'Failed to fetch subordinate details from ERP.',
      error.details || error.message
    );
  }
};

export const enrollLearnerTeam = async (req, res) => {
  const supervisorEmployeeNo = normalizeEmployeeNo(req.user, req.body);
  const { employeeNumbers, learningPathIds } = req.body;

  if (!Array.isArray(employeeNumbers) || employeeNumbers.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNumbers must be a non-empty array.');
  }
  if (!Array.isArray(learningPathIds) || learningPathIds.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'learningPathIds must be a non-empty array.');
  }

  try {
    const subordinates = await fetchEmployeeSubordinates(supervisorEmployeeNo);
    const subordinateNumbers = new Set(
      Array.isArray(subordinates?.data)
        ? subordinates.data.map((employee) => String(employee.employeeNumber).trim())
        : []
    );

    if (subordinateNumbers.size === 0) {
      return sendError(res, 403, 'FORBIDDEN', 'Learner is not a supervisor.');
    }

    const scopedEmployeeNumbers = employeeNumbers
      .map((value) => String(value).trim())
      .filter((value) => subordinateNumbers.has(value));

    if (scopedEmployeeNumbers.length === 0) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'No valid subordinate employeeNumbers were provided.'
      );
    }

    const employeeLookup = await query(
      `
        SELECT e.employee_number, e.principal_id
        FROM employees e
        WHERE e.employee_number = ANY($1::text[])
      `,
      [scopedEmployeeNumbers]
    );
    const principalByEmployeeNo = new Map(
      employeeLookup.rows.map((row) => [String(row.employee_number), row.principal_id])
    );

    const subordinateByEmployeeNo = new Map(
      Array.isArray(subordinates?.data)
        ? subordinates.data.map((row) => [String(row.employeeNumber).trim(), row])
        : []
    );

    const supervisorPrincipalId = await resolvePrincipalForLearner(req.user, supervisorEmployeeNo);
    for (const employeeNo of scopedEmployeeNumbers) {
      if (principalByEmployeeNo.has(employeeNo)) {
        continue;
      }
      const subordinateRow = subordinateByEmployeeNo.get(employeeNo) || null;
      const createdPrincipalId = await getOrCreateLearnerPrincipal({
        employeeNo,
        profileRow: subordinateRow,
        defaultDesignation: subordinateRow?.designation || 'Learner',
        defaultGradeName: subordinateRow?.gradeName || 'N/A',
        supervisorPrincipalId: supervisorPrincipalId || null
      });
      if (createdPrincipalId) {
        principalByEmployeeNo.set(employeeNo, createdPrincipalId);
      }
    }

    const pathsResult = await query(
      `
        SELECT id, title
        FROM learning_paths
        WHERE id = ANY($1::uuid[])
          AND is_deleted = FALSE
          AND status = 'ACTIVE'
      `,
      [learningPathIds]
    );
    const validPaths = pathsResult.rows;
    const validPathIdSet = new Set(validPaths.map((row) => String(row.id)));
    const invalidPathIds = learningPathIds.filter((id) => !validPathIdSet.has(id));
    if (invalidPathIds.length > 0) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'One or more learningPathIds are invalid or inactive.',
        { invalidPathIds }
      );
    }

    const assignments = [];
    let assignedCount = 0;
    for (const employeeNo of scopedEmployeeNumbers) {
      const principalId = principalByEmployeeNo.get(employeeNo);
      if (!principalId) {
        continue;
      }

      const assignedLearningPathIds = [];
      for (const path of validPaths) {
        const created = await query(
          `
            INSERT INTO enrollments (principal_id, learning_path_id, status, progress, enrolled_at, enrollment_source)
            VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'SUPERVISOR')
            ON CONFLICT (principal_id, learning_path_id) DO NOTHING
            RETURNING id
          `,
          [principalId, path.id]
        );

        if (created.rowCount > 0) {
          assignedLearningPathIds.push(String(path.id));
          assignedCount += 1;
          await query(
            `
              INSERT INTO notifications (principal_id, title, message, type, is_read)
              VALUES ($1, 'Learning Path Assigned', $2, 'INFO', FALSE)
            `,
            [principalId, `Your supervisor assigned "${path.title}".`]
          );
        }
      }

      assignments.push({
        employeeNo,
        assignedLearningPathIds
      });
    }

    return res.status(200).json({
      success: true,
      supervisorEmployeeNo,
      assignedCount,
      assignments
    });
  } catch (error) {
    return sendError(
      res,
      typeof error.status === 'number' ? error.status : 502,
      'ERP_REQUEST_FAILED',
      'Failed to validate subordinate details from ERP.',
      error.details || error.message
    );
  }
};

export const getCourses = async (_req, res) => {
  return res.status(200).json({
    courses: MOCK_COURSES
  });
};

export const getLearningPaths = async (_req, res) => {
  const result = await query(
    `
      SELECT id, title, description
      FROM learning_paths
      WHERE is_deleted = FALSE
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
    `
  );

  return res.status(200).json({
    learningPaths: result.rows
  });
};

export const getPublicLearningPaths = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    const result = await query(
      `
        SELECT lp.id, lp.title, lp.description, lp.category, lp.total_duration, lp.status,
               FALSE AS already_enrolled
        FROM learning_paths lp
        WHERE lp.is_deleted = FALSE
          AND lp.status = 'ACTIVE'
          AND lp.category = 'PUBLIC'
        ORDER BY lp.created_at DESC
      `
    );
    return res.status(200).json({ learningPaths: result.rows });
  }

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
    [principalId]
  );

  return res.status(200).json({ learningPaths: result.rows });
};

export const getPublicLearningPathById = async (req, res) => {
  const { id } = req.params;

  const pathResult = await query(
    `
      SELECT id, title, description, category, total_duration, status, created_at
      FROM learning_paths
      WHERE id = $1
        AND is_deleted = FALSE
        AND status = 'ACTIVE'
        AND category = 'PUBLIC'
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

export const selfEnrollPublicLearningPath = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const { learningPathId } = req.body;
  if (!learningPathId) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'learningPathId is required.');
  }

  let principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    let detailsRow = null;
    try {
      const detailsResponse = await fetchEmployeeDetailsForServiceNo(employeeNo);
      detailsRow = detailsResponse?.data?.[0] || null;
    } catch {
      detailsRow = null;
    }

    principalId = await getOrCreateLearnerPrincipal({
      employeeNo,
      profileRow: detailsRow,
      defaultDesignation: 'Learner',
      defaultGradeName: 'N/A',
      supervisorPrincipalId: null
    });
  }
  if (!principalId) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to initialize learner profile.');
  }

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
    [principalId, learningPathId]
  );

  if (created.rowCount === 0) {
    return sendError(res, 409, 'CONFLICT', 'You are already enrolled in this learning path.');
  }

  await query(
    `
      INSERT INTO notifications (principal_id, title, message, type, is_read)
      VALUES ($1, 'Self Enrollment Confirmed', $2, 'SUCCESS', FALSE)
    `,
    [principalId, `You have enrolled in "${path.title}".`]
  );

  return res.status(201).json({ enrollment: created.rows[0] });
};

export const getLearnerPathCourses = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const { enrollmentId } = req.params;
  const principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  const enrollmentResult = await query(
    `
      SELECT en.id, en.learning_path_id, en.progress, en.status, lp.title
      FROM enrollments en
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      WHERE en.id = $1
        AND en.principal_id = $2
        AND lp.is_deleted = FALSE
      LIMIT 1
    `,
    [enrollmentId, principalId]
  );
  const enrollment = enrollmentResult.rows[0];
  if (!enrollment) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  const coursesResult = await query(
    `
      SELECT
        COALESCE(c.id, lps.id) AS course_id,
        COALESCE(c.title, lps.title) AS title,
        lps.title AS stage_title,
        lps.stage_order,
        COALESCE(sc.course_order, lps.stage_order) AS course_order,
        COALESCE(ep.progress, 0) >= 100 AS is_completed
      FROM learning_path_stages lps
      LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
      LEFT JOIN courses c ON c.id = sc.course_id
      LEFT JOIN enrollment_progress ep
        ON ep.enrollment_id = $1
       AND (
         ep.course_id = COALESCE(c.id, lps.id)
         OR ep.stage_id = COALESCE(c.id, lps.id)
       )
      WHERE lps.learning_path_id = $2
      ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
    `,
    [enrollmentId, enrollment.learning_path_id]
  );

  const courses = coursesResult.rows.map((row) => {
    const mockCourse = getMockCourseByTitle(row.title);
    return {
      courseId: row.course_id,
      title: row.title,
      order: Number(row.course_order),
      stageTitle: row.stage_title,
      stageOrder: Number(row.stage_order),
      isCompleted: Boolean(row.is_completed),
      deliveryMode: mockCourse?.deliveryMode || 'ONLINE',
      venue: mockCourse?.venue || null,
      videoUrl: getMockCourseVideoUrlByTitle(row.title)
    };
  });
  const totalCourses = courses.length;
  const completedCourses = courses.filter((course) => course.isCompleted).length;

  return res.status(200).json({
    enrollment: {
      id: enrollment.id,
      learningPathId: enrollment.learning_path_id,
      learningPathTitle: enrollment.title,
      progress: Number(enrollment.progress || 0),
      status: enrollment.status,
      totalCourses,
      completedCourses
    },
    courses
  });
};

export const updateLearnerCourseCompletion = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const { enrollmentId, courseId } = req.params;
  const { completed } = req.body;
  if (typeof completed !== 'boolean') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'completed must be a boolean.');
  }

  const principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  const enrollmentResult = await query(
    `
      SELECT en.id, en.learning_path_id, en.progress, lp.title
      FROM enrollments en
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      WHERE en.id = $1
        AND en.principal_id = $2
        AND lp.is_deleted = FALSE
      LIMIT 1
    `,
    [enrollmentId, principalId]
  );
  const enrollment = enrollmentResult.rows[0];
  if (!enrollment) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }

  const stageCheck = await query(
    `
      SELECT
        COALESCE(c.id, lps.id) AS activity_id,
        c.id IS NOT NULL AS is_catalog_course
      FROM learning_path_stages lps
      LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
      LEFT JOIN courses c ON c.id = sc.course_id
      WHERE lps.learning_path_id = $2
        AND COALESCE(c.id, lps.id) = $1
      LIMIT 1
    `,
    [courseId, enrollment.learning_path_id]
  );
  if (stageCheck.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Course not found in this learning path.');
  }

  const match = stageCheck.rows[0];
  const isCatalogCourse = Boolean(match.is_catalog_course);

  if (isCatalogCourse) {
    await query(
      `
        INSERT INTO enrollment_progress (enrollment_id, stage_id, course_id, progress, created_at)
        VALUES ($1, NULL, $2, $3, NOW())
        ON CONFLICT (enrollment_id, course_id) WHERE course_id IS NOT NULL
        DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
      `,
      [enrollmentId, courseId, completed ? 100 : 0]
    );
  } else {
    await query(
      `
        INSERT INTO enrollment_progress (enrollment_id, stage_id, course_id, progress, created_at)
        VALUES ($1, $2, NULL, $3, NOW())
        ON CONFLICT (enrollment_id, stage_id) WHERE stage_id IS NOT NULL
        DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
      `,
      [enrollmentId, courseId, completed ? 100 : 0]
    );
  }

  const previousProgress = Number(enrollment.progress || 0);
  const computed = await recalculateEnrollmentFromStageProgress({
    enrollmentId,
    learningPathId: enrollment.learning_path_id,
    principalId
  });

  if (previousProgress < 100 && computed.computedProgress >= 100) {
    await query(
      `
        INSERT INTO certificates (principal_id, learning_path_id, scope, issued_by)
        VALUES ($1, $2, 'FULL', $1)
        ON CONFLICT (principal_id, learning_path_id, scope) DO NOTHING
      `,
      [principalId, enrollment.learning_path_id]
    );

    await query(
      `
        INSERT INTO notifications (principal_id, title, message, type, is_read)
        VALUES ($1, 'Certificate Issued',
                'Congratulations! You have completed this learning path and earned a certificate.',
                'SUCCESS', FALSE)
      `,
      [principalId]
    );

    try {
      const principalResult = await query(
        `
          SELECT name, email
          FROM auth_principals
          WHERE id = $1
          LIMIT 1
        `,
        [principalId]
      );
      const principal = principalResult.rows[0];
      if (principal?.email) {
        await sendLearningPathCompletionEmail({
          to: principal.email,
          learnerName: principal?.name,
          learningPathTitle: enrollment.title
        });
      }
    } catch (error) {
      console.warn('Failed to send learning path completion email.', error);
    }
  }

  const coursesResult = await query(
    `
      SELECT
        COALESCE(c.id, lps.id) AS course_id,
        COALESCE(c.title, lps.title) AS title,
        lps.title AS stage_title,
        lps.stage_order,
        COALESCE(sc.course_order, lps.stage_order) AS course_order,
        COALESCE(ep.progress, 0) >= 100 AS is_completed
      FROM learning_path_stages lps
      LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
      LEFT JOIN courses c ON c.id = sc.course_id
      LEFT JOIN enrollment_progress ep
        ON ep.enrollment_id = $1
       AND (
         ep.course_id = COALESCE(c.id, lps.id)
         OR ep.stage_id = COALESCE(c.id, lps.id)
       )
      WHERE lps.learning_path_id = $2
      ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
    `,
    [enrollmentId, enrollment.learning_path_id]
  );

  return res.status(200).json({
    enrollment: {
      id: computed.enrollment.id,
      learningPathId: computed.enrollment.learning_path_id,
      learningPathTitle: enrollment.title,
      progress: Number(computed.enrollment.progress || 0),
      status: computed.enrollment.status,
      totalCourses: computed.totalCourses,
      completedCourses: computed.completedCourses
    },
    courses: coursesResult.rows.map((row) => {
      const mockCourse = getMockCourseByTitle(row.title);
      return {
        courseId: row.course_id,
        title: row.title,
        order: Number(row.course_order),
        stageTitle: row.stage_title,
        stageOrder: Number(row.stage_order),
        isCompleted: Boolean(row.is_completed),
        deliveryMode: mockCourse?.deliveryMode || 'ONLINE',
        venue: mockCourse?.venue || null,
        videoUrl: getMockCourseVideoUrlByTitle(row.title)
      };
    })
  });
};

export const getLearnerCertificates = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    return res.status(200).json({ certificates: [] });
  }

  const result = await query(
    `
      SELECT
        c.id,
        c.scope,
        c.issued_at,
        lp.id AS learning_path_id,
        lp.title AS learning_path_title,
        lp.description AS learning_path_description,
        lp.total_duration AS learning_path_duration,
        ap.name AS learner_name,
        ap.email AS learner_email,
        en.completed_at
      FROM certificates c
      JOIN learning_paths lp ON lp.id = c.learning_path_id
      JOIN auth_principals ap ON ap.id = c.principal_id
      LEFT JOIN enrollments en
        ON en.principal_id = c.principal_id
       AND en.learning_path_id = c.learning_path_id
      WHERE c.principal_id = $1
      ORDER BY c.issued_at DESC
    `,
    [principalId]
  );

  return res.status(200).json({ certificates: result.rows });
};

// ─────────────────────────────────────────────────────────────────────────────
// buildCertificateTitle
//
// Converts the learning path title into the bold certificate heading shown at
// the top of the PDF, exactly matching the reference design:
//
//   Learning path title : "Compulsory Training"
//   Certificate heading : "COMPULSORY TRAINING CERTIFICATE"
//
//   Learning path title : "Health & Safety Induction"
//   Certificate heading : "HEALTH & SAFETY INDUCTION CERTIFICATE"
//
// The word "CERTIFICATE" is always appended as a separate word so path titles
// never need to include it themselves. The only exception is when the title
// already ends with "CERTIFICATE" (case-insensitive) to avoid duplication.
// ─────────────────────────────────────────────────────────────────────────────
const buildCertificateTitle = (learningPathTitle) => {
  const base = String(learningPathTitle || 'Learning Path').trim().toUpperCase();
  if (base.endsWith('CERTIFICATE')) {
    return base;
  }
  return `${base} CERTIFICATE`;
};

export const downloadLearnerCertificate = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const principalId = await resolvePrincipalForLearner(req.user, employeeNo);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Certificate not found.');
  }

  const { certificateId } = req.params;
  const result = await query(
    `
      SELECT
        c.id,
        c.scope,
        c.issued_at,
        lp.id AS learning_path_id,
        lp.title AS learning_path_title,
        lp.description AS learning_path_description,
        lp.total_duration AS learning_path_duration,
        lp.certificate_signer_name,
        lp.certificate_signer_title,
        lp.certificate_signature_file,
        lp.certificate_signature_file_type,
        ap.name AS learner_name,
        en.completed_at
      FROM certificates c
      JOIN learning_paths lp ON lp.id = c.learning_path_id
      JOIN auth_principals ap ON ap.id = c.principal_id
      LEFT JOIN enrollments en
        ON en.principal_id = c.principal_id
       AND en.learning_path_id = c.learning_path_id
      WHERE c.id = $1
        AND c.principal_id = $2
      LIMIT 1
    `,
    [certificateId, principalId]
  );

  const certificate = result.rows[0];
  if (!certificate) {
    return sendError(res, 404, 'NOT_FOUND', 'Certificate not found.');
  }

  // ── Fetch all courses for this learning path (stage order → course order) ──
  const coursesResult = await query(
    `
      SELECT
        COALESCE(c.title, lps.title)               AS course_title,
        c.duration                                  AS course_duration,
        lps.stage_order,
        COALESCE(sc.course_order, lps.stage_order)  AS course_order
      FROM learning_path_stages lps
      LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
      LEFT JOIN courses c        ON c.id = sc.course_id
      WHERE lps.learning_path_id = $1
      ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
    `,
    [certificate.learning_path_id]
  );

  const courseRows = coursesResult.rows.map((row) => ({
    title:    String(row.course_title || '').trim(),
    // duration is null until an admin populates it; rendered as blank cell
    duration: row.course_duration != null ? String(row.course_duration) : ''
  }));

  // ── Dynamic title: "<LEARNING PATH NAME> CERTIFICATE" ─────────────────────
  const certificateTitle = buildCertificateTitle(certificate.learning_path_title);

  // ── Date helpers ───────────────────────────────────────────────────────────
  const finishedDate    = certificate.completed_at || certificate.issued_at;
  const awardedDateText = new Date(finishedDate).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric'
  });

  // Certificate number formatted as TRPS/CC/XXXXXXXXX/YYYY
  const rawId      = String(certificate.id).replace(/-/g, '').toUpperCase();
  const serial     = rawId.slice(0, 9);
  const issueYear  = new Date(certificate.issued_at).getFullYear();
  const certNumber = `TRPS/CC/${serial}/${issueYear}`;

  const safeTitle = String(certificate.learning_path_title || 'learning_path')
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase();

  const signerName  = String(certificate.certificate_signer_name  || '').trim() || 'Learning Administrator';
  const signerTitle = String(certificate.certificate_signer_title || '').trim() || 'LPMS';

  // ── Signature image processing ─────────────────────────────────────────────
  let signatureImageBuffer = null;
  const sigFile     = certificate.certificate_signature_file;
  const sigFileType = certificate.certificate_signature_file_type;

  if (sigFile && sigFileType && sigFileType.startsWith('image/')) {
    try {
      const cleanedDataUri = await removeImageBackground(sigFile);
      const base64Data     = cleanedDataUri.includes(',')
        ? cleanedDataUri.split(',')[1]
        : cleanedDataUri;

      const { default: sharpLib } = await import('sharp');
      signatureImageBuffer = await sharpLib(Buffer.from(base64Data, 'base64'))
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
        .png()
        .toBuffer();
    } catch {
      signatureImageBuffer = null;
    }
  }

  // ── PDF engine ─────────────────────────────────────────────────────────────
  let PDFDocument;
  try {
    ({ default: PDFDocument } = await import('pdfkit'));
  } catch {
    return sendError(
      res,
      500,
      'PDF_ENGINE_NOT_AVAILABLE',
      'PDF generation library is not installed. Run npm install in server.'
    );
  }

  const filename = `certificate_${safeTitle}_${certificate.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // ── A4 page constants (595.28 × 841.89 pt) ────────────────────────────────
  const PAGE_W    = 595.28;
  const PAGE_H    = 841.89;
  const MARGIN    = 56;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true });
  doc.pipe(res);

  // ── Outer border ───────────────────────────────────────────────────────────
  doc
    .rect(28, 28, PAGE_W - 56, PAGE_H - 56)
    .lineWidth(1.5)
    .stroke('#888888');

  // ── Certificate title (dynamic) ────────────────────────────────────────────
  // Matches reference exactly: bold, centred, all-caps, e.g.
  // "COMPULSORY TRAINING CERTIFICATE"
  doc.moveDown(1);
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(certificateTitle, MARGIN, doc.y, {
      width: CONTENT_W,
      align: 'center'
    });

  // ── "This certificate is awarded to" ──────────────────────────────────────
  doc.moveDown(2);
  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#333333')
    .text('This certificate is awarded to', { width: CONTENT_W, align: 'center' });

  // ── Learner name ───────────────────────────────────────────────────────────
  doc.moveDown(0.8);
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(certificate.learner_name || `Employee ${employeeNo}`, {
      width: CONTENT_W,
      align: 'center'
    });

  // ── "On successful completion…" ────────────────────────────────────────────
  doc.moveDown(1);
  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#333333')
    .text('On successful completion of following e-learning courses', {
      width: CONTENT_W,
      align: 'center'
    });

  // ── Courses table ──────────────────────────────────────────────────────────
  doc.moveDown(1.2);

  const TABLE_TOP      = doc.y;
  const DURATION_W     = 90;
  const COL_COURSE_X   = MARGIN;
  const COL_DURATION_X = MARGIN + CONTENT_W - DURATION_W;
  const COURSE_COL_W   = CONTENT_W - DURATION_W;
  const ROW_H          = 22;
  const HEADER_H       = 36; // two-line header

  // Header background + border
  doc
    .rect(COL_COURSE_X, TABLE_TOP, CONTENT_W, HEADER_H)
    .fillAndStroke('#f0f0f0', '#aaaaaa');

  // "Courses" header label — centred within its column
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Courses', COL_COURSE_X + 8, TABLE_TOP + 12, {
      width: COURSE_COL_W - 16,
      align: 'center'
    });

  // "Duration" + "(hours)" stacked labels
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Duration', COL_DURATION_X, TABLE_TOP + 4, {
      width: DURATION_W,
      align: 'center'
    });
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#333333')
    .text('(hours)', COL_DURATION_X, TABLE_TOP + 17, {
      width: DURATION_W,
      align: 'center'
    });

  // Vertical divider inside the header
  doc
    .moveTo(COL_DURATION_X - 1, TABLE_TOP)
    .lineTo(COL_DURATION_X - 1, TABLE_TOP + HEADER_H)
    .lineWidth(0.5)
    .stroke('#aaaaaa');

  // ── Data rows ──────────────────────────────────────────────────────────────
  let currentY = TABLE_TOP + HEADER_H;

  courseRows.forEach((course, index) => {
    const rowBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

    doc
      .rect(COL_COURSE_X, currentY, CONTENT_W, ROW_H)
      .fillAndStroke(rowBg, '#cccccc');

    // Course title — bold, left-aligned, single line with ellipsis
    doc
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .fillColor('#111111')
      .text(course.title, COL_COURSE_X + 8, currentY + 6, {
        width:     COURSE_COL_W - 16,
        align:     'left',
        lineBreak: false,
        ellipsis:  true
      });

    // Duration value (blank until populated by admin)
    doc
      .fontSize(9.5)
      .font('Helvetica')
      .fillColor('#111111')
      .text(course.duration, COL_DURATION_X, currentY + 6, {
        width: DURATION_W - 4,
        align: 'center'
      });

    // Vertical divider for each row
    doc
      .moveTo(COL_DURATION_X - 1, currentY)
      .lineTo(COL_DURATION_X - 1, currentY + ROW_H)
      .lineWidth(0.5)
      .stroke('#cccccc');

    currentY += ROW_H;
  });

  // Bottom border of the table
  doc
    .moveTo(COL_COURSE_X, currentY)
    .lineTo(COL_COURSE_X + CONTENT_W, currentY)
    .lineWidth(0.5)
    .stroke('#aaaaaa');

  // ── Footer ─────────────────────────────────────────────────────────────────
  // Always push the footer to a minimum safe distance from the bottom of the
  // page so it never collides with the table, even for very long course lists.
  const FOOTER_TOP = Math.max(currentY + 40, PAGE_H - 160);

  // Left column: "Awarded on …" + "Certificate No: …"
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#333333')
    .text(`Awarded on ${awardedDateText}`, MARGIN, FOOTER_TOP, {
      width: CONTENT_W / 2,
      align: 'left'
    });
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#333333')
    .text(`Certificate No: ${certNumber}`, MARGIN, FOOTER_TOP + 14, {
      width: CONTENT_W / 2,
      align: 'left'
    });

  // ── Signature block (right side) ──────────────────────────────────────────
  const SIG_BLOCK_W = 180;
  const SIG_BLOCK_X = PAGE_W - MARGIN - SIG_BLOCK_W;
  const SIG_IMG_H   = 48;
  const SIG_IMG_TOP = FOOTER_TOP - 4;

  if (signatureImageBuffer) {
    try {
      doc.image(signatureImageBuffer, SIG_BLOCK_X, SIG_IMG_TOP, {
        width:  SIG_BLOCK_W,
        height: SIG_IMG_H,
        fit:    [SIG_BLOCK_W, SIG_IMG_H],
        align:  'center',
        valign: 'bottom'
      });
    } catch {
      // silently skip if image buffer is corrupt
    }
  } else {
    // Dotted placeholder when no signature image has been set
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#aaaaaa')
      .text('............................................', SIG_BLOCK_X, SIG_IMG_TOP + SIG_IMG_H - 12, {
        width: SIG_BLOCK_W,
        align: 'center'
      });
  }

  // Underline beneath signature
  const SIG_LINE_Y = SIG_IMG_TOP + SIG_IMG_H + 4;
  doc
    .moveTo(SIG_BLOCK_X, SIG_LINE_Y)
    .lineTo(SIG_BLOCK_X + SIG_BLOCK_W, SIG_LINE_Y)
    .lineWidth(0.75)
    .stroke('#888888');

  // Signer name
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#111111')
    .text(signerName, SIG_BLOCK_X, SIG_LINE_Y + 5, {
      width: SIG_BLOCK_W,
      align: 'center'
    });

  // Signer title / designation
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#444444')
    .text(signerTitle, SIG_BLOCK_X, SIG_LINE_Y + 18, {
      width: SIG_BLOCK_W,
      align: 'center'
    });

  doc.end();
  return undefined;
};