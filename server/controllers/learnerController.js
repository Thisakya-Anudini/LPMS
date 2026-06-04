import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { sendError } from '../utils/http.js';
import {
  fetchAllCourses,
  fetchCourseEnrollmentDetails,
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeeSubordinates
} from '../utils/erpClient.js';
import { isTemporaryErpLearnerAuth } from '../users/learner.js';
import { renderCertificatePdf } from '../utils/certificatePdf.js';
import {
  ASSIGNMENT_REPORT_SOURCE,
  createAssignmentReport
} from '../utils/assignmentReports.js';
import { sendCourseCompletedEmail } from '../utils/emailService.js';

const normalizeEmployeeNo = (user, requestBody = {}) => {
  if (user.employeeNo) {
    return String(user.employeeNo).trim();
  }
  if (requestBody.employeeNo && typeof requestBody.employeeNo === 'string') {
    return requestBody.employeeNo.trim();
  }
  return '';
};

const resolveActorPrincipalId = async (user) => {
  const employeeNo = normalizeEmployeeNo(user);
  if (employeeNo) {
    const result = await query(
      `
        SELECT principal_id
        FROM employees
        WHERE employee_number = $1
        LIMIT 1
      `,
      [employeeNo]
    );
    if (result.rowCount > 0) {
      return result.rows[0].principal_id;
    }
  }

  return String(user?.id || '').trim() || null;
};

const isSupervisorFromSubordinateResponse = (response) =>
  Boolean(Array.isArray(response?.data) && response.data.length > 0);

const normalizeNameFromRow = (row, employeeNo) => {
  if (row?.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }
  const initials = row?.employeeInitials ? String(row.employeeInitials).trim() : '';
  const surname = row?.employeeSurname ? String(row.employeeSurname).trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || `Learner ${employeeNo}`;
};

const normalizeCourseDeliveryMode = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PHYSICAL' || normalized === 'CLASSROOM') {
    return 'PHYSICAL';
  }
  if (normalized === 'HYBRID') {
    return 'ONLINE';
  }
  return 'ONLINE';
};

const normalizeErpCourse = (row, index = 0) => {
  const courseCode = String(row?.courseCode || '').trim();
  const courseName = String(row?.courseName || '').trim();
  const title = courseName || courseCode || `Course ${index + 1}`;
  return {
    id: courseCode || `ERP-COURSE-${index + 1}`,
    code: courseCode || `ERP-COURSE-${index + 1}`,
    title,
    description: null,
    durationHours: null,
    deliveryMode: null,
    venue: null,
    videoUrl: null
  };
};

const normalizeCourseKey = (value) => String(value || '').trim().toLowerCase();

const normalizeDisplayValue = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || ['-', 'n/a', 'na', 'null', 'undefined'].includes(normalized.toLowerCase())) {
    return null;
  }
  return normalized;
};

const normalizeLooseKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeErpStatusLabel = (value) => {
  const label = String(value || '').trim();
  if (!label) {
    return 'Not Enrolled';
  }
  return label
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeErpStatusKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const isCompletedErpStatus = (value) => {
  const normalized = normalizeErpStatusKey(value);
  return [
    'COMPLETED',
    'COMPLETE',
    'PASSED',
    'SUCCESSFULLY COMPLETED',
    'COURSE COMPLETED'
  ].includes(normalized);
};

const getFirstValue = (row, keys) => {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
};

const extractErpRows = (response) => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  if (Array.isArray(response?.Data)) {
    return response.Data;
  }
  if (Array.isArray(response?.result)) {
    return response.result;
  }
  if (Array.isArray(response?.Result)) {
    return response.Result;
  }
  return [];
};

const normalizeErpEnrollmentRow = (row) => {
  const courseCode = String(
    getFirstValue(row, [
      'courseCode',
      'CourseCode',
      'courseID',
      'courseId',
      'CourseID',
      'CourseId',
      'courseNo',
      'CourseNo'
    ]) || ''
  ).trim();
  const courseTitle = String(
    getFirstValue(row, [
      'courseName',
      'CourseName',
      'courseTitle',
      'CourseTitle',
      'title',
      'Title'
    ]) || ''
  ).trim();
  const status = String(
    getFirstValue(row, [
      'status',
      'Status',
      'enrollmentStatus',
      'EnrollmentStatus',
      'courseStatus',
      'CourseStatus',
      'approvalStatus',
      'ApprovalStatus'
    ]) || ''
  ).trim();
  const duration = normalizeDisplayValue(
    getFirstValue(row, [
      'duration',
      'Duration',
      'courseDuration',
      'CourseDuration',
      'durationHours',
      'DurationHours',
      'courseDurationHours',
      'CourseDurationHours',
      'hours',
      'Hours'
    ])
  );

  return {
    courseCode,
    courseTitle,
    duration,
    status,
    statusLabel: normalizeErpStatusLabel(status),
    isCompleted: isCompletedErpStatus(status),
    raw: row
  };
};

const buildErpEnrollmentIndex = (rows) => {
  const index = new Map();

  for (const row of rows.map(normalizeErpEnrollmentRow)) {
    const keys = [
      normalizeLooseKey(row.courseCode),
      normalizeLooseKey(row.courseTitle)
    ].filter(Boolean);

    for (const key of keys) {
      if (!index.has(key) || row.isCompleted) {
        index.set(key, row);
      }
    }
  }

  return index;
};

const findErpEnrollmentForCourse = (index, course) => {
  const keys = [
    course.courseCode,
    course.courseId,
    course.title
  ].map(normalizeLooseKey).filter(Boolean);

  for (const key of keys) {
    if (index.has(key)) {
      return index.get(key);
    }
  }
  return null;
};

const hasCertificateSignatureColumn = async () => {
  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'learning_paths'
          AND column_name = 'certificate_signature_png'
      ) AS present
    `
  );

  return Boolean(result.rows[0]?.present);
};

const hasTable = async (tableName) => {
  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS present
    `,
    [tableName]
  );

  return Boolean(result.rows[0]?.present);
};

const hasColumn = async (tableName, columnName) => {
  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS present
    `,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.present);
};

const usesCourseReferenceTable = async () =>
  (await hasTable('courses')) &&
  (await hasColumn('stage_courses', 'course_id')) &&
  (await hasColumn('enrollment_progress', 'course_id'));

const resolveDashboardPrincipalId = async (user) => {
  if (!isTemporaryErpLearnerAuth(user)) {
    return String(user?.id || '').trim() || null;
  }

  const employeeNo = String(user?.employeeNo || '').trim();
  if (!employeeNo) {
    return null;
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

const resolvePrincipalForLearner = async (user) => resolveDashboardPrincipalId(user);

const getOrCreateLearnerPrincipal = async (employeeNo, employeeRow = null) => {
  const normalizedEmployeeNo = String(employeeNo || '').trim();
  if (!normalizedEmployeeNo) {
    return null;
  }

  const existingEmployee = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [normalizedEmployeeNo]
  );
  if (existingEmployee.rowCount > 0) {
    return existingEmployee.rows[0].principal_id;
  }

  let learnerRow = employeeRow;
  if (!learnerRow) {
    try {
      const detailsResponse = await fetchEmployeeDetailsForServiceNo(normalizedEmployeeNo);
      learnerRow = detailsResponse?.data?.[0] || null;
    } catch {
      learnerRow = null;
    }
  }

  const fallbackDomain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || 'erp.local';
  const normalizedEmail =
    learnerRow?.email && String(learnerRow.email).trim()
      ? String(learnerRow.email).trim().toLowerCase()
      : `${normalizedEmployeeNo}@${fallbackDomain}`;
  const learnerName = normalizeNameFromRow(learnerRow, normalizedEmployeeNo);
  const designation =
    learnerRow?.designation && String(learnerRow.designation).trim()
      ? String(learnerRow.designation).trim()
      : 'Learner';
  const gradeName =
    learnerRow?.gradeName && String(learnerRow.gradeName).trim()
      ? String(learnerRow.gradeName).trim()
      : 'N/A';

  let principalId = null;
  const existingPrincipal = await query(
    `
      SELECT ap.id, e.employee_number
      FROM auth_principals ap
      LEFT JOIN employees e ON e.principal_id = ap.id
      WHERE ap.email = $1
      LIMIT 1
    `,
    [normalizedEmail]
  );

  if (existingPrincipal.rowCount > 0) {
    const matchedEmployeeNumber = String(existingPrincipal.rows[0].employee_number || '').trim();
    if (!matchedEmployeeNumber || matchedEmployeeNumber === normalizedEmployeeNo) {
      principalId = existingPrincipal.rows[0].id;
    }
  }

  let principalEmail = normalizedEmail;
  if (!principalId) {
    const fallbackEmailBase = `${normalizedEmployeeNo}@${fallbackDomain}`;
    const hasProvidedEmail = Boolean(normalizedEmail);
    principalEmail = hasProvidedEmail ? normalizedEmail : fallbackEmailBase;
    let emailSuffix = 1;

    while (true) {
      const fallbackPrincipal = await query(
        `
          SELECT ap.id, e.employee_number
          FROM auth_principals ap
          LEFT JOIN employees e ON e.principal_id = ap.id
          WHERE ap.email = $1
          LIMIT 1
        `,
        [principalEmail]
      );

      if (fallbackPrincipal.rowCount === 0) {
        break;
      }

      const fallbackEmployeeNumber = String(fallbackPrincipal.rows[0].employee_number || '').trim();
      if (!fallbackEmployeeNumber || fallbackEmployeeNumber === normalizedEmployeeNo) {
        principalId = fallbackPrincipal.rows[0].id;
        break;
      }

      emailSuffix += 1;
      principalEmail = `${normalizedEmployeeNo}+${emailSuffix}@${fallbackDomain}`;
    }
  }

  if (!principalId) {
    const passwordHash = await bcrypt.hash(normalizedEmployeeNo, 10);
    const createdPrincipal = await query(
      `
        INSERT INTO auth_principals (email, password_hash, role, name, principal_type, must_change_password)
        VALUES ($1, $2, 'EMPLOYEE', $3, 'EMPLOYEE', FALSE)
        RETURNING id
      `,
      [principalEmail, passwordHash, learnerName]
    );
    principalId = createdPrincipal.rows[0].id;
  }

  if (principalId && normalizedEmail) {
    const principalResult = await query(
      `
        SELECT email
        FROM auth_principals
        WHERE id = $1
        LIMIT 1
      `,
      [principalId]
    );
    const currentPrincipalEmail = String(principalResult.rows[0]?.email || '').trim().toLowerCase();
    const usesFallbackEmail =
      currentPrincipalEmail.endsWith(`@${fallbackDomain}`) ||
      currentPrincipalEmail.includes(`+`) && currentPrincipalEmail.endsWith(`@${fallbackDomain}`);

    if (usesFallbackEmail && currentPrincipalEmail !== normalizedEmail) {
      const emailOwner = await query(
        `
          SELECT id
          FROM auth_principals
          WHERE email = $1
          LIMIT 1
        `,
        [normalizedEmail]
      );

      if (emailOwner.rowCount === 0 || emailOwner.rows[0].id === principalId) {
        await query(
          `
            UPDATE auth_principals
            SET email = $2
            WHERE id = $1
          `,
          [principalId, normalizedEmail]
        );
      }
    }
  }

  const existingEmployeeForPrincipal = await query(
    `
      SELECT id, employee_number
      FROM employees
      WHERE principal_id = $1
      LIMIT 1
    `,
    [principalId]
  );

  if (existingEmployeeForPrincipal.rowCount > 0) {
    const currentEmployeeNumber = String(existingEmployeeForPrincipal.rows[0].employee_number || '').trim();
    if (currentEmployeeNumber === normalizedEmployeeNo) {
      await query(
        `
          UPDATE employees
          SET designation = $2, grade_name = $3, updated_at = NOW()
          WHERE principal_id = $1
        `,
        [principalId, designation, gradeName]
      );
      return principalId;
    }

    await query(
      `
        UPDATE employees
        SET designation = $2, grade_name = $3, updated_at = NOW()
        WHERE principal_id = $1
      `,
      [principalId, designation, gradeName]
    );
    return principalId;
  }

  await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, NULL)
      ON CONFLICT (employee_number) DO NOTHING
    `,
    [principalId, normalizedEmployeeNo, designation, gradeName]
  );

  return principalId;
};

const recalculateEnrollmentFromStageProgress = async ({
  enrollmentId,
  learningPathId,
  principalId
}) => {
  const useCourseReference = await usesCourseReferenceTable();
  const aggregate = await query(
    useCourseReference
      ? `
          WITH scoped_activities AS (
            SELECT sc.course_id AS activity_id
            FROM learning_path_stages lps
            JOIN stage_courses sc ON sc.stage_id = lps.id
            WHERE lps.learning_path_id = $2
            UNION
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
          FROM scoped_activities sa
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (ep.course_id = sa.activity_id OR ep.stage_id = sa.activity_id)
        `
      : `
          WITH scoped_activities AS (
            SELECT COALESCE(sc.course_code, sc.course_title) AS activity_id
            FROM learning_path_stages lps
            JOIN stage_courses sc ON sc.stage_id = lps.id
            WHERE lps.learning_path_id = $2
            UNION
            SELECT lps.id::text AS activity_id
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
          FROM scoped_activities sa
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (ep.course_code = sa.activity_id OR ep.stage_id::text = sa.activity_id)
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

const listLearnerPathCourses = async ({ enrollmentId, learningPathId, useCourseReference }) => {
  const coursesResult = await query(
    useCourseReference
      ? `
          SELECT
            COALESCE(course.id, lps.id) AS course_id,
            course.id AS progress_course_id,
            lps.id AS stage_id,
            course.code AS course_code,
            COALESCE(course.title, lps.title) AS title,
            lps.title AS stage_title,
            lps.stage_order,
            COALESCE(sc.course_order, lps.stage_order) AS course_order,
            course.duration AS course_duration,
            CASE
              WHEN course.type = 'CLASSROOM' THEN 'PHYSICAL'
              WHEN course.type = 'HYBRID' THEN 'ONLINE'
              ELSE 'ONLINE'
            END AS delivery_mode,
            COALESCE(ep.progress, 0) >= 100 AS is_completed
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          LEFT JOIN courses course ON course.id = sc.course_id
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (
             ep.course_id = course.id
             OR (course.id IS NULL AND ep.stage_id = lps.id)
           )
          WHERE lps.learning_path_id = $2
          ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
        `
      : `
          SELECT
            COALESCE(sc.course_code, lps.id::text) AS course_id,
            NULL::uuid AS progress_course_id,
            lps.id AS stage_id,
            sc.course_code,
            COALESCE(sc.course_title, lps.title) AS title,
            lps.title AS stage_title,
            lps.stage_order,
            COALESCE(sc.course_order, lps.stage_order) AS course_order,
            sc.course_duration,
            COALESCE(sc.delivery_mode, 'ONLINE') AS delivery_mode,
            COALESCE(ep.progress, 0) >= 100 AS is_completed
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (
             ep.course_code = sc.course_code
             OR (sc.course_code IS NULL AND ep.stage_id = lps.id)
           )
          WHERE lps.learning_path_id = $2
          ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
        `,
    [enrollmentId, learningPathId]
  );

  return coursesResult.rows.map((row) => ({
    courseId: row.course_id,
    progressCourseId: row.progress_course_id,
    stageId: row.stage_id,
    courseCode: row.course_code,
    title: row.title,
    duration: normalizeDisplayValue(row.course_duration),
    order: Number(row.course_order),
    stageTitle: row.stage_title,
    stageOrder: Number(row.stage_order),
    isCompleted: Boolean(row.is_completed),
    deliveryMode: normalizeCourseDeliveryMode(row.delivery_mode),
    venue: null,
    videoUrl: null,
    erpStatus: null,
    erpStatusRaw: null
  }));
};

const persistErpCourseProgress = async ({ enrollmentId, courses, useCourseReference }) => {
  for (const course of courses) {
    const progress = course.isCompleted ? 100 : 0;
    const progressCourseId = String(course.progressCourseId || '').trim();
    const stageId = String(course.stageId || '').trim();
    const courseCode = String(course.courseCode || '').trim();

    if (useCourseReference && progressCourseId) {
      await query(
        `
          INSERT INTO enrollment_progress (enrollment_id, course_id, stage_id, progress, created_at)
          VALUES ($1, $2, NULL, $3, NOW())
          ON CONFLICT (enrollment_id, course_id) WHERE course_id IS NOT NULL
          DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
        `,
        [enrollmentId, progressCourseId, progress]
      );
    } else if (!useCourseReference && courseCode) {
      await query(
        `
          INSERT INTO enrollment_progress (enrollment_id, course_code, stage_id, progress, created_at)
          VALUES ($1, $2, NULL, $3, NOW())
          ON CONFLICT (enrollment_id, course_code) WHERE course_code IS NOT NULL
          DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
        `,
        [enrollmentId, courseCode, progress]
      );
    } else if (stageId) {
      await query(
        `
          INSERT INTO enrollment_progress (enrollment_id, stage_id, progress, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (enrollment_id, stage_id) WHERE stage_id IS NOT NULL
          DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
        `,
        [enrollmentId, stageId, progress]
      );
    }
  }
};

const applyErpCourseStatuses = async ({
  enrollment,
  principalId,
  erpEnrollmentIndex,
  useCourseReference,
  persistProgress = true
}) => {
  const courses = await listLearnerPathCourses({
    enrollmentId: enrollment.id,
    learningPathId: enrollment.learning_path_id,
    useCourseReference
  });

  const enrichedCourses = courses.map((course) => {
    const erpEnrollment = findErpEnrollmentForCourse(erpEnrollmentIndex, course);
    const erpCompleted = Boolean(erpEnrollment?.isCompleted);
    return {
      ...course,
      duration: erpEnrollment?.duration || course.duration,
      isCompleted: erpCompleted,
      erpStatus: erpEnrollment?.statusLabel || 'Not Enrolled',
      erpStatusRaw: erpEnrollment?.status || null
    };
  });

  const totalCourses = enrichedCourses.length;
  const completedCourses = enrichedCourses.filter((course) => course.isCompleted).length;
  const computedProgress =
    totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
  const status =
    computedProgress >= 100 ? 'COMPLETED' : computedProgress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

  let updatedEnrollment = {
    ...enrollment,
    progress: computedProgress,
    status
  };

  if (persistProgress) {
    await persistErpCourseProgress({
      enrollmentId: enrollment.id,
      courses: enrichedCourses,
      useCourseReference
    });

    const updateResult = await query(
      `
        UPDATE enrollments
        SET progress = $2,
            status = $3,
            completed_at = CASE WHEN $2 >= 100 THEN COALESCE(completed_at, NOW()) ELSE NULL END
        WHERE id = $1
          AND principal_id = $4
        RETURNING id, learning_path_id, progress, status, completed_at
      `,
      [enrollment.id, computedProgress, status, principalId]
    );
    updatedEnrollment = updateResult.rows[0] || updatedEnrollment;
  }

  return {
    enrollment: updatedEnrollment,
    courses: enrichedCourses.map(({ courseCode, progressCourseId, stageId, erpStatusRaw, ...course }) => course),
    totalCourses,
    completedCourses,
    computedProgress
  };
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

  const principalId = await resolveDashboardPrincipalId(req.user);
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
          title: 'Learner access ready',
          message:
            'This learner is authenticated by temporary ERP credentials but is not yet imported into LPMS.',
          type: 'INFO'
        }
      ]
    });
  }

  const useCourseReference = await usesCourseReferenceTable();
  let erpEnrollmentIndex = new Map();
  try {
    const erpEnrollmentResponse = await fetchCourseEnrollmentDetails(employeeNo);
    erpEnrollmentIndex = buildErpEnrollmentIndex(extractErpRows(erpEnrollmentResponse));
  } catch (error) {
    console.warn('LPMS ERP course enrollment sync failed:', {
      employeeNo,
      message: error.message,
      details: error.details
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

  const assignedLearningPaths = [];
  for (const row of pathsResult.rows) {
    const synced = erpEnrollmentIndex.size > 0
      ? await applyErpCourseStatuses({
        enrollment: {
          id: row.enrollment_id,
          learning_path_id: row.learning_path_id,
          progress: row.progress,
          status: row.status
        },
        principalId,
        erpEnrollmentIndex,
        useCourseReference,
        persistProgress: true
      })
      : null;

    assignedLearningPaths.push({
      enrollmentId: row.enrollment_id,
      learningPathId: row.learning_path_id,
      title: row.title,
      progress: Number(synced?.enrollment?.progress ?? row.progress ?? 0),
      status: synced?.enrollment?.status || row.status
    });
  }

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
    const subordinateRows = Array.isArray(subordinates?.data) ? subordinates.data : [];
    const subordinateNumbers = new Set(
      subordinateRows.map((employee) => String(employee.employeeNumber || '').trim()).filter(Boolean)
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
    const insertedLearnersByPathId = new Map();
    for (const employeeNo of scopedEmployeeNumbers) {
      const subordinateRow =
        subordinateRows.find((row) => String(row?.employeeNumber || '').trim() === employeeNo) || null;
      const principalId = await getOrCreateLearnerPrincipal(employeeNo, subordinateRow);
      if (!principalId) {
        assignments.push({ employeeNo, assignedLearningPathIds: [] });
        continue;
      }

      const assignedLearningPathIds = [];
      for (const path of validPaths) {
        const created = await query(
          `
            INSERT INTO enrollments (
              principal_id,
              learning_path_id,
              status,
              progress,
              enrolled_at,
              enrollment_source
            )
            VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'SUPERVISOR')
            ON CONFLICT (principal_id, learning_path_id) DO NOTHING
            RETURNING id
          `,
          [principalId, path.id]
        );

        if (created.rowCount > 0) {
          assignedLearningPathIds.push(String(path.id));
          assignedCount += 1;
          const pathId = String(path.id);
          const currentLearners = insertedLearnersByPathId.get(pathId) || [];
          currentLearners.push({
            principalId,
            employeeNumber: employeeNo,
            learnerName: normalizeNameFromRow(subordinateRow, employeeNo),
            learnerEmail:
              subordinateRow?.email && String(subordinateRow.email).trim()
                ? String(subordinateRow.email).trim().toLowerCase()
                : '',
            designation:
              subordinateRow?.designation && String(subordinateRow.designation).trim()
                ? String(subordinateRow.designation).trim()
                : 'Learner',
            gradeName:
              subordinateRow?.gradeName && String(subordinateRow.gradeName).trim()
                ? String(subordinateRow.gradeName).trim()
                : 'N/A'
          });
          insertedLearnersByPathId.set(pathId, currentLearners);
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

    const actorPrincipalId = await resolveActorPrincipalId(req.user);
    for (const path of validPaths) {
      const pathLearners = insertedLearnersByPathId.get(String(path.id)) || [];
      if (pathLearners.length === 0) {
        continue;
      }

      await createAssignmentReport({
        learningPathId: String(path.id),
        learningPathTitle: String(path.title || '').trim() || 'Learning Path',
        assignedByPrincipalId: actorPrincipalId,
        assignedByName: req.user.name || 'Supervisor',
        assignedByRole: req.user.role || 'EMPLOYEE',
        assignmentSource: ASSIGNMENT_REPORT_SOURCE.SUPERVISOR,
        learners: pathLearners
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
  try {
    const response = await fetchAllCourses();
    const rows = Array.isArray(response?.data) ? response.data : [];
    return res.status(200).json({
      courses: rows
        .map((row, index) => normalizeErpCourse(row, index))
        .filter((course) => Boolean(course.code) && Boolean(course.title))
    });
  } catch (error) {
    return sendError(
      res,
      typeof error.status === 'number' ? error.status : 502,
      'ERP_REQUEST_FAILED',
      'Failed to fetch courses from ERP.',
      error.details || error.message
    );
  }
};

export const getLearnerOtherCourses = async (req, res) => {
  const principalId = await resolvePrincipalForLearner(req.user);

  try {
    const courseResponse = await fetchAllCourses();
    const erpCourses = (Array.isArray(courseResponse?.data) ? courseResponse.data : [])
      .map((row, index) => normalizeErpCourse(row, index))
      .filter((course) => Boolean(course.code) && Boolean(course.title));

    if (!principalId) {
      return res.status(200).json({
        alreadyEnrolledCourses: [],
        preferredCourses: erpCourses,
        courses: erpCourses.map((course) => ({ ...course, alreadyEnrolled: false, learningPaths: [] }))
      });
    }

    const useCourseReference = await usesCourseReferenceTable();
    const enrolledResult = await query(
      useCourseReference
        ? `
            SELECT
              en.id AS enrollment_id,
              en.status AS enrollment_status,
              en.progress,
              lp.id AS learning_path_id,
              lp.title AS learning_path_title,
              lp.description AS learning_path_description,
              lp.category AS learning_path_category,
              lp.total_duration AS learning_path_duration,
              COALESCE(c.id::text, sc.course_code, sc.course_title) AS course_id,
              COALESCE(c.code, sc.course_code) AS course_code,
              COALESCE(c.title, sc.course_title) AS course_title,
              COALESCE(c.description, sc.course_title) AS course_description,
              COALESCE(c.duration, sc.course_duration) AS course_duration,
              CASE
                WHEN c.type = 'CLASSROOM' THEN 'PHYSICAL'
                WHEN c.type = 'HYBRID' THEN 'ONLINE'
                ELSE COALESCE(sc.delivery_mode, 'ONLINE')
              END AS delivery_mode,
              lps.title AS stage_title,
              lps.stage_order,
              sc.course_order
            FROM enrollments en
            JOIN learning_paths lp ON lp.id = en.learning_path_id
            JOIN learning_path_stages lps ON lps.learning_path_id = lp.id
            JOIN stage_courses sc ON sc.stage_id = lps.id
            LEFT JOIN courses c ON c.id = sc.course_id
            WHERE en.principal_id = $1
              AND lp.is_deleted = FALSE
              AND lp.status = 'ACTIVE'
            ORDER BY en.enrolled_at DESC, lp.title ASC, lps.stage_order ASC, sc.course_order ASC
          `
        : `
            SELECT
              en.id AS enrollment_id,
              en.status AS enrollment_status,
              en.progress,
              lp.id AS learning_path_id,
              lp.title AS learning_path_title,
              lp.description AS learning_path_description,
              lp.category AS learning_path_category,
              lp.total_duration AS learning_path_duration,
              COALESCE(sc.course_code, sc.course_title) AS course_id,
              sc.course_code,
              sc.course_title,
              sc.course_title AS course_description,
              sc.course_duration,
              COALESCE(sc.delivery_mode, 'ONLINE') AS delivery_mode,
              lps.title AS stage_title,
              lps.stage_order,
              sc.course_order
            FROM enrollments en
            JOIN learning_paths lp ON lp.id = en.learning_path_id
            JOIN learning_path_stages lps ON lps.learning_path_id = lp.id
            JOIN stage_courses sc ON sc.stage_id = lps.id
            WHERE en.principal_id = $1
              AND lp.is_deleted = FALSE
              AND lp.status = 'ACTIVE'
            ORDER BY en.enrolled_at DESC, lp.title ASC, lps.stage_order ASC, sc.course_order ASC
          `,
      [principalId]
    );

    const alreadyEnrolledCourses = enrolledResult.rows.map((row) => ({
      id: row.course_id || row.course_code || row.course_title,
      code: row.course_code || row.course_id || row.course_title,
      title: row.course_title || row.course_code || 'Course',
      description: row.course_description || null,
      durationHours: null,
      duration: row.course_duration || null,
      deliveryMode: normalizeCourseDeliveryMode(row.delivery_mode),
      stageTitle: row.stage_title,
      stageOrder: Number(row.stage_order || 0),
      courseOrder: Number(row.course_order || 0),
      enrollment: {
        id: row.enrollment_id,
        status: row.enrollment_status,
        progress: Number(row.progress || 0)
      },
      learningPath: {
        id: row.learning_path_id,
        title: row.learning_path_title,
        description: row.learning_path_description,
        category: row.learning_path_category,
        totalDuration: row.learning_path_duration
      }
    }));

    const enrolledKeys = new Set(
      alreadyEnrolledCourses
        .flatMap((course) => [course.code, course.title])
        .map(normalizeCourseKey)
        .filter(Boolean)
    );

    const learningPathsByCourseKey = new Map();
    for (const course of alreadyEnrolledCourses) {
      for (const key of [course.code, course.title].map(normalizeCourseKey).filter(Boolean)) {
        if (!learningPathsByCourseKey.has(key)) {
          learningPathsByCourseKey.set(key, []);
        }
        const paths = learningPathsByCourseKey.get(key);
        if (!paths.some((path) => path.id === course.learningPath.id)) {
          paths.push(course.learningPath);
        }
      }
    }

    const courses = erpCourses.map((course) => {
      const keys = [course.code, course.title].map(normalizeCourseKey).filter(Boolean);
      const alreadyEnrolled = keys.some((key) => enrolledKeys.has(key));
      const learningPaths = keys.flatMap((key) => learningPathsByCourseKey.get(key) || []);
      const uniqueLearningPaths = learningPaths.filter(
        (path, index, list) => list.findIndex((item) => item.id === path.id) === index
      );

      return {
        ...course,
        alreadyEnrolled,
        learningPaths: uniqueLearningPaths
      };
    });

    return res.status(200).json({
      alreadyEnrolledCourses,
      preferredCourses: courses.filter((course) => !course.alreadyEnrolled),
      courses
    });
  } catch (error) {
    return sendError(
      res,
      typeof error.status === 'number' ? error.status : 502,
      'ERP_REQUEST_FAILED',
      'Failed to fetch learner courses from ERP.',
      error.details || error.message
    );
  }
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
  const principalId = await resolvePrincipalForLearner(req.user);
  if (!principalId) {
    const result = await query(
      `
        SELECT id, title, description, category, total_duration, status, FALSE AS already_enrolled
        FROM learning_paths
        WHERE is_deleted = FALSE
          AND status = 'ACTIVE'
          AND category = 'PUBLIC'
        ORDER BY created_at DESC
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
  const useCourseReference = await usesCourseReferenceTable();

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
    useCourseReference
      ? `
          SELECT
            lps.id AS stage_id,
            course.id AS course_id,
            course.title AS course_title,
            sc.course_order,
            CASE
              WHEN course.type = 'ONLINE' THEN 'ONLINE'
              ELSE 'PHYSICAL'
            END AS delivery_mode
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          JOIN courses course ON course.id = sc.course_id
          WHERE lps.learning_path_id = $1
          ORDER BY lps.stage_order ASC, sc.course_order ASC
        `
      : `
          SELECT
            lps.id AS stage_id,
            COALESCE(sc.course_code, sc.course_title) AS course_id,
            sc.course_title AS course_title,
            sc.course_order,
            COALESCE(sc.delivery_mode, 'ONLINE') AS delivery_mode
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
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

  const principalId = await getOrCreateLearnerPrincipal(employeeNo);
  if (!principalId) {
    return sendError(res, 500, 'ENROLLMENT_FAILED', 'Unable to provision learner account.');
  }

  const created = await query(
    `
      INSERT INTO enrollments (
        principal_id,
        learning_path_id,
        status,
        progress,
        enrolled_at,
        enrollment_source
      )
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

  const principalId = await resolvePrincipalForLearner(req.user);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }
  const useCourseReference = await usesCourseReferenceTable();

  const { enrollmentId } = req.params;
  const enrollmentResult = await query(
    `
      SELECT en.id, en.learning_path_id, en.progress, en.status, lp.title, lp.total_duration
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

  let synced = null;
  try {
    const erpEnrollmentResponse = await fetchCourseEnrollmentDetails(employeeNo);
    const erpEnrollmentIndex = buildErpEnrollmentIndex(extractErpRows(erpEnrollmentResponse));
    if (erpEnrollmentIndex.size > 0) {
      synced = await applyErpCourseStatuses({
        enrollment,
        principalId,
        erpEnrollmentIndex,
        useCourseReference,
        persistProgress: true
      });
    }
  } catch (error) {
    console.warn('LPMS ERP course enrollment sync failed:', {
      employeeNo,
      enrollmentId,
      message: error.message,
      details: error.details
    });
  }

  const courses = synced?.courses || await listLearnerPathCourses({
    enrollmentId,
    learningPathId: enrollment.learning_path_id,
    useCourseReference
  });
  const totalCourses = synced?.totalCourses ?? courses.length;
  const completedCourses =
    synced?.completedCourses ?? courses.filter((course) => course.isCompleted).length;

  return res.status(200).json({
    enrollment: {
      id: synced?.enrollment?.id || enrollment.id,
      learningPathId: synced?.enrollment?.learning_path_id || enrollment.learning_path_id,
      learningPathTitle: enrollment.title,
      totalDuration: enrollment.total_duration,
      progress: Number(synced?.enrollment?.progress ?? enrollment.progress ?? 0),
      status: synced?.enrollment?.status || enrollment.status,
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

  const principalId = await resolvePrincipalForLearner(req.user);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Enrollment not found.');
  }
  const useCourseReference = await usesCourseReferenceTable();

  const { enrollmentId, courseId } = req.params;
  const { completed } = req.body;
  if (typeof completed !== 'boolean') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'completed must be a boolean.');
  }

  const enrollmentResult = await query(
    `
      SELECT
        en.id,
        en.learning_path_id,
        en.progress,
        lp.title,
        ap.name AS learner_name,
        ap.email AS learner_email,
        e.employee_number
      FROM enrollments en
      JOIN learning_paths lp ON lp.id = en.learning_path_id
      JOIN auth_principals ap ON ap.id = en.principal_id
      LEFT JOIN employees e ON e.principal_id = ap.id
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

  const courseCheck = await query(
    useCourseReference
      ? `
          SELECT
            course.id AS course_id,
            lps.id AS stage_id,
            course.code AS course_code,
            COALESCE(course.title, lps.title) AS course_title
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          LEFT JOIN courses course ON course.id = sc.course_id
          WHERE lps.learning_path_id = $2
            AND (course.id = $1 OR lps.id = $1)
          LIMIT 1
        `
      : `
          SELECT
            NULL::uuid AS course_id,
            lps.id AS stage_id,
            sc.course_code,
            COALESCE(sc.course_title, lps.title) AS course_title
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          WHERE lps.learning_path_id = $2
            AND (sc.course_code = $1 OR lps.id::text = $1)
          LIMIT 1
        `,
    [courseId, enrollment.learning_path_id]
  );
  if (courseCheck.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Course not found in this learning path.');
  }

  const match = courseCheck.rows[0];
  let previousCourseCompleted = false;
  if (useCourseReference && match.course_id) {
    const previous = await query(
      `
        SELECT progress
        FROM enrollment_progress
        WHERE enrollment_id = $1
          AND course_id = $2
        LIMIT 1
      `,
      [enrollmentId, match.course_id]
    );
    previousCourseCompleted = Number(previous.rows[0]?.progress || 0) >= 100;
  } else if (!useCourseReference && match.course_code) {
    const previous = await query(
      `
        SELECT progress
        FROM enrollment_progress
        WHERE enrollment_id = $1
          AND course_code = $2
        LIMIT 1
      `,
      [enrollmentId, match.course_code]
    );
    previousCourseCompleted = Number(previous.rows[0]?.progress || 0) >= 100;
  } else {
    const previous = await query(
      `
        SELECT progress
        FROM enrollment_progress
        WHERE enrollment_id = $1
          AND stage_id = $2
        LIMIT 1
      `,
      [enrollmentId, match.stage_id]
    );
    previousCourseCompleted = Number(previous.rows[0]?.progress || 0) >= 100;
  }

  if (useCourseReference && match.course_id) {
    await query(
      `
        INSERT INTO enrollment_progress (enrollment_id, course_id, stage_id, progress, created_at)
        VALUES ($1, $2, NULL, $3, NOW())
        ON CONFLICT (enrollment_id, course_id) WHERE course_id IS NOT NULL
        DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
      `,
      [enrollmentId, match.course_id, completed ? 100 : 0]
    );
  } else if (!useCourseReference && match.course_code) {
    await query(
      `
        INSERT INTO enrollment_progress (enrollment_id, course_code, stage_id, progress, created_at)
        VALUES ($1, $2, NULL, $3, NOW())
        ON CONFLICT (enrollment_id, course_code) WHERE course_code IS NOT NULL
        DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
      `,
      [enrollmentId, match.course_code, completed ? 100 : 0]
    );
  } else {
    await query(
      `
        INSERT INTO enrollment_progress (enrollment_id, stage_id, progress, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (enrollment_id, stage_id) WHERE stage_id IS NOT NULL
        DO UPDATE SET progress = EXCLUDED.progress, created_at = NOW()
      `,
      [enrollmentId, match.stage_id, completed ? 100 : 0]
    );
  }

  const previousProgress = Number(enrollment.progress || 0);
  const computed = await recalculateEnrollmentFromStageProgress({
    enrollmentId,
    learningPathId: enrollment.learning_path_id,
    principalId
  });

  if (completed && !previousCourseCompleted) {
    await sendCourseCompletedEmail({
      employeeNumber: String(enrollment.employee_number || employeeNo || '').trim(),
      to: enrollment.learner_email ? String(enrollment.learner_email).trim().toLowerCase() : '',
      learnerName: enrollment.learner_name,
      learningPathTitle: enrollment.title,
      courseTitle: match.course_title,
      courseCode: match.course_code || courseId
    });
  }

  if (previousProgress < 100 && computed.computedProgress >= 100) {
    let learnerProfile = null;
    try {
      const detailsResponse = await fetchEmployeeDetailsForServiceNo(employeeNo);
      learnerProfile = detailsResponse?.data?.[0] || null;
    } catch {
      learnerProfile = null;
    }

    await query(
      `
        INSERT INTO certificates (principal_id, learning_path_id, scope, issued_by, learner_name, learner_email)
        VALUES ($1, $2, 'FULL', $1, $3, $4)
        ON CONFLICT (principal_id, learning_path_id, scope) DO NOTHING
      `,
      [
        principalId,
        enrollment.learning_path_id,
        normalizeNameFromRow(learnerProfile, employeeNo),
        learnerProfile?.email ? String(learnerProfile.email).trim().toLowerCase() : null
      ]
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
  }

  const coursesResult = await query(
    useCourseReference
      ? `
          SELECT
            COALESCE(course.id, lps.id) AS course_id,
            COALESCE(course.title, lps.title) AS title,
            lps.title AS stage_title,
            lps.stage_order,
            COALESCE(sc.course_order, lps.stage_order) AS course_order,
            CASE
              WHEN course.type = 'CLASSROOM' THEN 'PHYSICAL'
              WHEN course.type = 'HYBRID' THEN 'ONLINE'
              ELSE 'ONLINE'
            END AS delivery_mode,
            COALESCE(ep.progress, 0) >= 100 AS is_completed
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          LEFT JOIN courses course ON course.id = sc.course_id
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (
             ep.course_id = course.id
             OR (course.id IS NULL AND ep.stage_id = lps.id)
           )
          WHERE lps.learning_path_id = $2
          ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
        `
      : `
          SELECT
            COALESCE(sc.course_code, lps.id::text) AS course_id,
            COALESCE(sc.course_title, lps.title) AS title,
            lps.title AS stage_title,
            lps.stage_order,
            COALESCE(sc.course_order, lps.stage_order) AS course_order,
            COALESCE(sc.delivery_mode, 'ONLINE') AS delivery_mode,
            COALESCE(ep.progress, 0) >= 100 AS is_completed
          FROM learning_path_stages lps
          LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
          LEFT JOIN enrollment_progress ep
            ON ep.enrollment_id = $1
           AND (
             ep.course_code = sc.course_code
             OR (sc.course_code IS NULL AND ep.stage_id = lps.id)
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
      return {
        courseId: row.course_id,
        title: row.title,
        order: Number(row.course_order),
        stageTitle: row.stage_title,
        stageOrder: Number(row.stage_order),
        isCompleted: Boolean(row.is_completed),
        deliveryMode: normalizeCourseDeliveryMode(row.delivery_mode),
        venue: null,
        videoUrl: null
      };
    })
  });
};

export const getLearnerCertificates = async (req, res) => {
  const principalId = await resolvePrincipalForLearner(req.user);
  if (!principalId) {
    return res.status(200).json({ certificates: [] });
  }

  const result = await query(
    `
      SELECT
        cert.id,
        cert.scope,
        cert.issued_at,
        lp.id AS learning_path_id,
        lp.title AS learning_path_title,
        lp.description AS learning_path_description,
        lp.total_duration AS learning_path_duration,
        COALESCE(cert.learner_name, ap.name) AS learner_name,
        COALESCE(cert.learner_email, ap.email) AS learner_email,
        en.completed_at
      FROM certificates cert
      JOIN learning_paths lp ON lp.id = cert.learning_path_id
      LEFT JOIN auth_principals ap ON ap.id = cert.principal_id
      LEFT JOIN enrollments en
        ON en.principal_id = cert.principal_id
       AND en.learning_path_id = cert.learning_path_id
      WHERE cert.principal_id = $1
      ORDER BY cert.issued_at DESC
    `,
    [principalId]
  );

  return res.status(200).json({ certificates: result.rows });
};

export const downloadLearnerCertificate = async (req, res) => {
  const employeeNo = normalizeEmployeeNo(req.user, req.body);
  if (!employeeNo) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  const principalId = await resolvePrincipalForLearner(req.user);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Certificate not found.');
  }

  const { certificateId } = req.params;
  const includeSignatureColumn = await hasCertificateSignatureColumn();
  const useCourseReference = await usesCourseReferenceTable();
  const result = await query(
    `
      SELECT
        cert.id,
        cert.principal_id,
        e.employee_number,
        cert.learning_path_id,
        cert.scope,
        cert.issued_at,
        lp.title AS learning_path_title,
        lp.description AS learning_path_description,
        lp.total_duration AS learning_path_duration,
        lp.certificate_signer_name,
        lp.certificate_signer_title,
        ${includeSignatureColumn ? 'lp.certificate_signature_png' : 'NULL::text AS certificate_signature_png'},
        COALESCE(cert.learner_name, ap.name) AS learner_name,
        en.completed_at
      FROM certificates cert
      JOIN learning_paths lp ON lp.id = cert.learning_path_id
      LEFT JOIN auth_principals ap ON ap.id = cert.principal_id
      LEFT JOIN employees e ON e.principal_id = cert.principal_id
      LEFT JOIN enrollments en
        ON en.principal_id = cert.principal_id
       AND en.learning_path_id = cert.learning_path_id
      WHERE cert.id = $1
        AND cert.principal_id = $2
      LIMIT 1
    `,
    [certificateId, principalId]
  );

  const certificate = result.rows[0];
  if (!certificate) {
    return sendError(res, 404, 'NOT_FOUND', 'Certificate not found.');
  }

  const coursesResult = await query(
    useCourseReference
      ? `
          SELECT
            lps.title AS stage_title,
            lps.stage_order,
            course.title AS course_title,
            course.duration AS course_duration,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          JOIN courses course ON course.id = sc.course_id
          WHERE lps.learning_path_id = (
            SELECT learning_path_id
            FROM certificates
            WHERE id = $1
            LIMIT 1
          )
          ORDER BY lps.stage_order ASC, sc.course_order ASC
        `
      : `
          SELECT
            lps.title AS stage_title,
            lps.stage_order,
            sc.course_title AS course_title,
            sc.course_duration AS course_duration,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          WHERE lps.learning_path_id = (
            SELECT learning_path_id
            FROM certificates
            WHERE id = $1
            LIMIT 1
          )
          ORDER BY lps.stage_order ASC, sc.course_order ASC
        `,
    [certificateId]
  );

  const finishedDate = certificate.completed_at || certificate.issued_at;
  const awardedYear = new Date(finishedDate).getFullYear();
  const safeTitle = String(certificate.learning_path_title || 'learning_path')
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase();
  const signerName = String(certificate.certificate_signer_name || '').trim() || 'Learning Administrator';
  const signerTitle = String(certificate.certificate_signer_title || '').trim() || 'LPMS';
  const learnerIdentifier = String(certificate.employee_number || employeeNo).trim();
  const certificateNumber = `${certificate.learning_path_id || 'LP'}/${learnerIdentifier}/${awardedYear}`;
  const signaturePngDataUrl = String(certificate.certificate_signature_png || '').trim();

  const filename = `certificate_${safeTitle}_${certificate.id}.pdf`;
  const courses = coursesResult.rows.map((row) => ({
    title: String(row.course_title || '').trim(),
    duration: String(row.course_duration || '').trim() || '-'
  }));
  try {
    await renderCertificatePdf({
      res,
      filename,
      certificateTitle: certificate.learning_path_title,
      learnerName: certificate.learner_name || '-',
      learnerIdentifier,
      finishedDate,
      learningPathDuration: certificate.learning_path_duration || '-',
      signerName,
      signerTitle,
      signaturePngDataUrl,
      certificateNumber,
      courses
    });
    return undefined;
  } catch (error) {
    if (error?.code === 'PDF_ENGINE_NOT_AVAILABLE') {
      return sendError(res, 500, error.code, error.message);
    }
    return sendError(res, 500, 'CERTIFICATE_RENDER_FAILED', 'Failed to generate certificate preview.');
  }
};
