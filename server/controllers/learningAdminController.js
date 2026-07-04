import { query } from '../db.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';
import bcrypt from 'bcryptjs';
import {
  fetchAllCourses,
  fetchClassesByCourseCode,
  fetchAllDesignations,
  fetchAllSalaryGrades,
  fetchEmployeesByFilters,
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeesByPartialName,
  fetchOrganizationList
} from '../utils/erpClient.js';
import { renderCertificatePdf } from '../utils/certificatePdf.js';
import {
  ASSIGNMENT_REPORT_SOURCE,
  ASSIGNMENT_REPORT_STATUS,
  createAssignmentReport
} from '../utils/assignmentReports.js';
import { parseTotalDurationValue } from '../utils/duration.js';
import {
  sendClassAssignedEmail,
  sendLearningPathAssignedEmail
} from '../utils/emailService.js';

const parseCategory = (value) => {
  const allowed = ['RESTRICTED', 'PUBLIC'];
  if (!allowed.includes(value)) {
    return null;
  }
  return value;
};

const validateLearningPathTitle = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { valid: false, message: 'title is required.' };
  }

  const allowedTitleRegex = /^[A-Za-z\s\-_.,&()'":\/]+$/;
  if (!allowedTitleRegex.test(normalized)) {
    return { valid: false, message: 'title may only contain letters, spaces, and common punctuation.' };
  }

  if (!/[A-Za-z]/.test(normalized)) {
    return { valid: false, message: 'title must include at least one letter.' };
  }

  return { valid: true };
};

const isStructuredStagePayload = (stages) =>
  Array.isArray(stages) && stages.some((stage) => Array.isArray(stage?.courses));

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXECUTIVE_PAYROLL = 'SLT Executive Payroll';
const NON_EXECUTIVE_PAYROLL = 'SLT Non Executive Payroll';
const ALL_DESIGNATIONS_FILTER = 'alldes';
const ALL_GRADES_FILTER = 'allgra';
const ALL_ORGANIZATIONS_FILTER = 'allorg';
const ALL_PAYROLLS_FILTER = 'allpay';
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024;

const normalizeEmployeeDisplayName = (row, employeeNo) => {
  if (row?.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }
  const initials = row?.employeeInitials ? String(row.employeeInitials).trim() : '';
  const surname = row?.employeeSurname ? String(row.employeeSurname).trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || `Learner ${employeeNo}`;
};

const normalizeEmployeeRow = (row) => ({
  employeeNumber: String(row?.employeeNumber || '').trim(),
  employeeName: normalizeEmployeeDisplayName(row, row?.employeeNumber || ''),
  employeeSurname: row?.employeeSurname ? String(row.employeeSurname).trim() : '',
  designation: row?.designation ? String(row.designation).trim() : '',
  gradeName: row?.gradeName ? String(row.gradeName).trim() : '',
  email: row?.email ? String(row.email).trim().toLowerCase() : '',
  organizationName: row?.orgName ? String(row.orgName).trim() : '',
  costCenterCode: row?.employeeCostCode ? String(row.employeeCostCode).trim() : '',
  costCenterName: row?.employeeCostCentreName ? String(row.employeeCostCentreName).trim() : '',
  employeeInitials: row?.employeeInitials ? String(row.employeeInitials).trim() : '',
  employeeSupervisorNumber: row?.employeeSupervisorNumber ? String(row.employeeSupervisorNumber).trim() : ''
});

const mergeEmployeeRows = (base = {}, incoming = {}) => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== '' &&
      (!merged[key] || String(merged[key]).trim() === '')
    ) {
      merged[key] = value;
    }
  }
  return merged;
};

const mapLearningAdminAssignments = async (employees = []) => {
  const employeeNumbers = employees
    .map((employee) => String(employee?.employeeNumber || '').trim())
    .filter(Boolean);

  if (employeeNumbers.length === 0) {
    return new Set();
  }

  const assignments = await query(
    `
      SELECT employee_number
      FROM learning_admin_assignments
      WHERE employee_number = ANY($1::text[])
    `,
    [employeeNumbers]
  );

  return new Set(
    assignments.rows.map((row) => String(row.employee_number || '').trim()).filter(Boolean)
  );
};

const normalizeOptionList = (rows, key) =>
  Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => String(row?.[key] || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

const normalizeSignaturePngDataUrl = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized.startsWith(PNG_DATA_URL_PREFIX)) {
    return { error: 'Signature must be a PNG image.' };
  }

  try {
    const binary = Buffer.from(normalized.slice(PNG_DATA_URL_PREFIX.length), 'base64');
    if (binary.length === 0) {
      return { error: 'Signature image is empty.' };
    }
    if (binary.length > MAX_SIGNATURE_SIZE_BYTES) {
      return { error: 'Signature image must be 2 MB or smaller.' };
    }
  } catch {
    return { error: 'Signature image is invalid.' };
  }

  return { value: normalized };
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

const getSearchErrorStatus = (error) => (typeof error?.status === 'number' ? error.status : 502);

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

const normalizeErpCourseCatalog = (rows) =>
  new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row, index) => {
        const code = String(row?.courseCode || '').trim();
        const title = String(row?.courseName || '').trim() || code || `Course ${index + 1}`;
        return code ? [code, { code, title }] : null;
      })
      .filter(Boolean)
  );

const pickFirstString = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  const normalizedLookup = new Map(
    Object.entries(row || {}).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      value
    ])
  );
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const value = normalizedLookup.get(normalizedKey);
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
};

const pickFirstByTokens = (row, tokenGroups) => {
  const entries = Object.entries(row || {});
  for (const tokens of tokenGroups) {
    const normalizedTokens = tokens.map((token) => token.toLowerCase());
    const match = entries.find(([key, value]) => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return false;
      }
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedTokens.every((token) => normalizedKey.includes(token));
    });
    if (match) {
      return String(match[1]).trim();
    }
  }
  return '';
};

const normalizeErpClassRow = (row, index) => {
  const classId =
    pickFirstString(row, ['classId', 'classID', 'class_id', 'id', 'classCode', 'classNo', 'batchId', 'batchCode']) ||
    `CLASS-${index + 1}`;
  const classCode = pickFirstString(row, ['classCode', 'classNo', 'class_code', 'batchCode', 'batchNo']) || classId;
  const classTitle =
    pickFirstString(row, ['className', 'classTitle', 'title', 'batchName', 'name', 'description']) ||
    `Class ${index + 1}`;

  return {
    id: classId,
    code: classCode,
    title: classTitle,
    startDate:
      pickFirstString(row, [
        'startDate',
        'classStartDate',
        'courseStartDate',
        'sessionStartDate',
        'fromDate',
        'dateFrom',
        'startDt',
        'fromDt',
        'commenceDate',
        'commencementDate'
      ]) ||
      pickFirstByTokens(row, [
        ['start', 'date'],
        ['from', 'date'],
        ['commence', 'date']
      ]),
    endDate:
      pickFirstString(row, [
        'endDate',
        'classEndDate',
        'courseEndDate',
        'sessionEndDate',
        'toDate',
        'dateTo',
        'endDt',
        'toDt',
        'completionDate',
        'finishDate'
      ]) ||
      pickFirstByTokens(row, [
        ['end', 'date'],
        ['to', 'date'],
        ['completion', 'date'],
        ['finish', 'date']
      ]),
    venue: pickFirstString(row, ['venue', 'location', 'classVenue', 'trainingLocation']),
    instructor: pickFirstString(row, ['instructor', 'lecturer', 'trainer', 'resourcePerson']),
    capacity: pickFirstString(row, ['capacity', 'maxParticipants', 'noOfParticipants', 'seats']),
    raw: row || {}
  };
};

const resolveCourseUuid = async (courseId, courseCatalogByCode = new Map()) => {
  const raw = String(courseId || '').trim();
  if (!raw) {
    return null;
  }

  if (UUID_LIKE.test(raw)) {
    return raw;
  }

  const existing = await query(
    `
      SELECT id
      FROM courses
      WHERE code = $1
      LIMIT 1
    `,
    [raw]
  );
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const courseFromCatalog = courseCatalogByCode.get(raw);
  if (!courseFromCatalog) {
    return null;
  }

  const created = await query(
    `
      INSERT INTO courses (code, title, description, duration, type)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (code) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          duration = EXCLUDED.duration,
          type = EXCLUDED.type
      RETURNING id
    `,
    [
      courseFromCatalog.code,
      courseFromCatalog.title,
      courseFromCatalog.title,
      '-',
      'ONLINE'
    ]
  );

  return created.rows[0].id;
};

const getOrCreateLearnerPrincipalForEnrollment = async (employee) => {
  const employeeNumber = String(employee?.employeeNumber || '').trim();
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
  const email =
    (employee?.email ? String(employee.email).trim().toLowerCase() : '') || `${employeeNumber}@${fallbackDomain}`;
  const name = normalizeEmployeeDisplayName(employee, employeeNumber);
  const designation = employee?.designation ? String(employee.designation).trim() : 'Learner';
  const gradeName = employee?.gradeName ? String(employee.gradeName).trim() : 'N/A';

  let principalId = null;
  const existingPrincipal = await query(
    `
      SELECT ap.id, e.employee_number
      FROM auth_principals
      ap
      LEFT JOIN employees e ON e.principal_id = ap.id
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );
  if (existingPrincipal.rowCount > 0) {
    const matchedEmployeeNumber = String(existingPrincipal.rows[0].employee_number || '').trim();
    if (!matchedEmployeeNumber || matchedEmployeeNumber === employeeNumber) {
      principalId = existingPrincipal.rows[0].id;
    }
  } else {
    principalId = null;
  }

  let principalEmail = email;
  if (!principalId) {
    const fallbackEmailBase = `${employeeNumber}@${fallbackDomain}`;
    const hasProvidedEmail = Boolean(email);
    principalEmail = hasProvidedEmail ? email : fallbackEmailBase;
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
      if (!fallbackEmployeeNumber || fallbackEmployeeNumber === employeeNumber) {
        principalId = fallbackPrincipal.rows[0].id;
        break;
      }

      emailSuffix += 1;
      principalEmail = `${employeeNumber}+${emailSuffix}@${fallbackDomain}`;
    }
  }

  if (!principalId) {
    const passwordHash = await bcrypt.hash(employeeNumber, 10);
    const createdPrincipal = await query(
      `
        INSERT INTO auth_principals (email, password_hash, role, name, principal_type, must_change_password)
        VALUES ($1, $2, 'EMPLOYEE', $3, 'EMPLOYEE', FALSE)
        RETURNING id
      `,
      [principalEmail, passwordHash, name]
    );
    principalId = createdPrincipal.rows[0].id;
  }

  if (principalId && email) {
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

    if (usesFallbackEmail && currentPrincipalEmail !== email) {
      const emailOwner = await query(
        `
          SELECT id
          FROM auth_principals
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

      if (emailOwner.rowCount === 0 || emailOwner.rows[0].id === principalId) {
        await query(
          `
            UPDATE auth_principals
            SET email = $2
            WHERE id = $1
          `,
          [principalId, email]
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
    if (currentEmployeeNumber === employeeNumber) {
      await query(
        `
          UPDATE employees
          SET designation = $2, grade_name = $3, updated_at = NOW()
          WHERE principal_id = $1
        `,
        [principalId, designation || 'Learner', gradeName || 'N/A']
      );
      return principalId;
    }

    await query(
      `
        UPDATE employees
        SET designation = $2, grade_name = $3, updated_at = NOW()
        WHERE principal_id = $1
      `,
      [principalId, designation || 'Learner', gradeName || 'N/A']
    );
    return principalId;
  }

  await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, NULL)
      ON CONFLICT (employee_number) DO NOTHING
    `,
    [principalId, employeeNumber, designation || 'Learner', gradeName || 'N/A']
  );

  return principalId;
};

const insertLearningPathStages = async ({ learningPathId, stages = [] }) => {
  if (!Array.isArray(stages) || stages.length === 0) {
    return;
  }

  const usesCourseReferenceTable =
    (await hasTable('courses')) &&
    (await hasColumn('stage_courses', 'course_id'));

  const needsCourseCatalogLookup = stages.some((stage) =>
    Array.isArray(stage?.courses) &&
    stage.courses.some((course) => course?.courseId && !UUID_LIKE.test(String(course.courseId).trim()))
  );
  let courseCatalogByCode = new Map();
  if (needsCourseCatalogLookup) {
    const courseResponse = await fetchAllCourses();
    courseCatalogByCode = normalizeErpCourseCatalog(courseResponse?.data);
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
      const courseCode = String(stageCourse.courseId).trim();
      const courseFromCatalog = courseCatalogByCode.get(courseCode) || null;

      if (usesCourseReferenceTable) {
        const resolvedCourseId = await resolveCourseUuid(stageCourse.courseId, courseCatalogByCode);
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
        continue;
      }

      await query(
        `
          INSERT INTO stage_courses (
            stage_id,
            course_code,
            course_title,
            course_duration,
            delivery_mode,
            video_url,
            venue,
            course_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          stageId,
          courseCode || null,
          courseFromCatalog?.title || courseCode || `Course ${courseIndex + 1}`,
          '-',
          'ONLINE',
          null,
          null,
          stageCourse.order || courseIndex + 1
        ]
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
  const titleValidation = validateLearningPathTitle(title);
  if (!titleValidation.valid) {
    return sendError(res, 400, 'VALIDATION_ERROR', titleValidation.message);
  }
  const durationValidation = parseTotalDurationValue(totalDuration);
  if (!durationValidation.valid) {
    return sendError(res, 400, 'VALIDATION_ERROR', durationValidation.message);
  }

  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'title is required.');
  }

  // Prevent exact-title duplicates (case-insensitive). If an existing learning path
  // with the same title exists, return 409 with details so the client can warn the user.
  const existingTitleResult = await query(
    `
      SELECT id, title
      FROM learning_paths
      WHERE lower(title) = lower($1) AND is_deleted = FALSE
    `,
    [normalizedTitle]
  );

  if (existingTitleResult.rowCount > 0) {
    // Check for overlapping courses between the new payload and existing learning paths
    const existingIds = existingTitleResult.rows.map((r) => r.id);
    const usesCourseReferenceTable =
      (await hasTable('courses')) &&
      (await hasColumn('stage_courses', 'course_id'));

    let courseRows = [];
    if (usesCourseReferenceTable) {
      courseRows = (
        await query(
          `
            SELECT lps.learning_path_id AS learning_path_id, c.id AS course_id, c.title AS course_title
            FROM learning_path_stages lps
            JOIN stage_courses sc ON sc.stage_id = lps.id
            JOIN courses c ON c.id = sc.course_id
            WHERE lps.learning_path_id = ANY($1::uuid[])
          `,
          [existingIds]
        )
      ).rows;
    } else {
      courseRows = (
        await query(
          `
            SELECT lps.learning_path_id AS learning_path_id, sc.course_code AS course_code, sc.course_title AS course_title
            FROM learning_path_stages lps
            JOIN stage_courses sc ON sc.stage_id = lps.id
            WHERE lps.learning_path_id = ANY($1::uuid[])
          `,
          [existingIds]
        )
      ).rows;
    }

    // Build set of course identifiers from incoming payload
    const incomingCourseIds = new Set();
    const incomingCourseCodes = new Set();
    if (Array.isArray(stages)) {
      for (const stage of stages) {
        if (Array.isArray(stage?.courses)) {
          for (const c of stage.courses) {
            const cid = String(c?.courseId || '').trim();
            if (!cid) continue;
            if (usesCourseReferenceTable) incomingCourseIds.add(cid);
            else incomingCourseCodes.add(cid);
          }
        }
      }
    }

    const existingDetails = existingTitleResult.rows.map((row) => ({ id: row.id, title: row.title, overlappingCourses: [] }));

    for (const r of courseRows) {
      if (usesCourseReferenceTable) {
        if (incomingCourseIds.has(String(r.course_id))) {
          const target = existingDetails.find((d) => d.id === r.learning_path_id);
          if (target) {
            target.overlappingCourses.push({ id: r.course_id, title: r.course_title });
          }
        }
      } else {
        if (incomingCourseCodes.has(String(r.course_code))) {
          const target = existingDetails.find((d) => d.id === r.learning_path_id);
          if (target) {
            target.overlappingCourses.push({ code: r.course_code, title: r.course_title });
          }
        }
      }
    }

    // Only treat as a duplicate if there is at least one overlapping course between
    // the incoming payload and an existing learning path with the same title.
    const hasOverlap = existingDetails.some((d) => Array.isArray(d.overlappingCourses) && d.overlappingCourses.length > 0);
    if (hasOverlap) {
      return sendError(res, 409, 'DUPLICATE_LEARNING_PATH', 'Learning path with same title and overlapping courses already exists.', {
        existing: existingDetails
      });
    }
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

  const usesCourseReferenceTable =
    (await hasTable('courses')) &&
    (await hasColumn('stage_courses', 'course_id'));

  const stageCourseResult = await query(
    usesCourseReferenceTable
      ? `
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

  if (title !== undefined) {
    const titleValidation = validateLearningPathTitle(title);
    if (!titleValidation.valid) {
      return sendError(res, 400, 'VALIDATION_ERROR', titleValidation.message);
    }
  }

  if (totalDuration !== undefined) {
    const durationValidation = parseTotalDurationValue(totalDuration);
    if (!durationValidation.valid) {
      return sendError(res, 400, 'VALIDATION_ERROR', durationValidation.message);
    }
  }

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
  const includeSignatureColumn = await hasCertificateSignatureColumn();
  const result = await query(
    `
      SELECT
        id,
        title,
        certificate_signer_name,
        certificate_signer_title,
        ${includeSignatureColumn ? 'certificate_signature_png' : 'NULL::text AS certificate_signature_png'},
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
  const signaturePngInput = normalizeSignaturePngDataUrl(req.body.signaturePngDataUrl);
  const includeSignatureColumn = await hasCertificateSignatureColumn();

  if (!signerName || !signerTitle) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'signerName and signerTitle are required.');
  }
  if (signaturePngInput?.error) {
    return sendError(res, 400, 'VALIDATION_ERROR', signaturePngInput.error);
  }
  if (signaturePngInput?.value && !includeSignatureColumn) {
    return sendError(
      res,
      500,
      'MIGRATION_REQUIRED',
      'PNG signature storage is not ready. Run the latest database migration and try again.'
    );
  }

  const result = await query(
    `
      UPDATE learning_paths
      SET certificate_signer_name = $2,
          certificate_signer_title = $3,
          ${includeSignatureColumn ? 'certificate_signature_png = COALESCE($4, certificate_signature_png),' : ''}
          updated_at = NOW()
      WHERE id = $1
        AND is_deleted = FALSE
      RETURNING id, title, certificate_signer_name, certificate_signer_title,
        ${includeSignatureColumn ? 'certificate_signature_png' : 'NULL::text AS certificate_signature_png'},
        updated_at
    `,
    [id, signerName, signerTitle, signaturePngInput?.value ?? null]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  await logAudit({
    actorPrincipalId,
    action: 'UPDATE_CERTIFICATE_SIGNATURE',
    resourceType: 'LEARNING_PATH',
    resourceId: id,
    metadata: { signerName, signerTitle, hasSignaturePng: Boolean(signaturePngInput?.value) }
  });

  return res.status(200).json({ learningPath: result.rows[0] });
};

export const previewLearningPathCertificate = async (req, res) => {
  const { id } = req.params;
  const includeSignatureColumn = await hasCertificateSignatureColumn();
  const usesCourseReferenceTable =
    (await hasTable('courses')) &&
    (await hasColumn('stage_courses', 'course_id'));
  const signerNameOverride = typeof req.body?.signerName === 'string' ? req.body.signerName.trim() : '';
  const signerTitleOverride = typeof req.body?.signerTitle === 'string' ? req.body.signerTitle.trim() : '';
  const signaturePngInput = normalizeSignaturePngDataUrl(req.body?.signaturePngDataUrl);

  if (signaturePngInput?.error) {
    return sendError(res, 400, 'VALIDATION_ERROR', signaturePngInput.error);
  }
  if (signaturePngInput?.value && !includeSignatureColumn) {
    return sendError(
      res,
      500,
      'MIGRATION_REQUIRED',
      'PNG signature storage is not ready. Run the latest database migration and try again.'
    );
  }

  const pathResult = await query(
    `
      SELECT
        id,
        title,
        total_duration,
        certificate_signer_name,
        certificate_signer_title,
        ${includeSignatureColumn ? 'certificate_signature_png' : 'NULL::text AS certificate_signature_png'}
      FROM learning_paths
      WHERE id = $1
        AND is_deleted = FALSE
      LIMIT 1
    `,
    [id]
  );

  const learningPath = pathResult.rows[0];
  if (!learningPath) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  const coursesResult = usesCourseReferenceTable
    ? await query(
        `
          SELECT
            course.title AS course_title,
            course.duration AS course_duration,
            lps.stage_order,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          JOIN courses course ON course.id = sc.course_id
          WHERE lps.learning_path_id = $1
          ORDER BY lps.stage_order ASC, sc.course_order ASC
        `,
        [id]
      )
    : await query(
        `
          SELECT
            sc.course_title AS course_title,
            sc.course_duration AS course_duration,
            lps.stage_order,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          WHERE lps.learning_path_id = $1
          ORDER BY lps.stage_order ASC, sc.course_order ASC
        `,
        [id]
      );

  const previewDate = new Date();
  const previewYear = previewDate.getFullYear();
  const learnerIdentifier = 'PREVIEW-0001';
  const certificateNumber = `${learningPath.id || 'LP'}/${learnerIdentifier}/${previewYear}`;
  const safeTitle = String(learningPath.title || 'learning_path')
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase();
  const filename = `certificate_preview_${safeTitle}.pdf`;
  const courses = coursesResult.rows.map((row) => ({
    title: String(row.course_title || '').trim(),
    duration: String(row.course_duration || '').trim() || '-'
  }));

  try {
    await renderCertificatePdf({
      res,
      filename,
      certificateTitle: learningPath.title,
      learnerName: 'Sample Learner',
      learnerIdentifier,
      finishedDate: previewDate,
      learningPathDuration: learningPath.total_duration || '-',
      signerName: signerNameOverride || learningPath.certificate_signer_name || 'Learning Administrator',
      signerTitle: signerTitleOverride || learningPath.certificate_signer_title || 'LPMS',
      signaturePngDataUrl: signaturePngInput?.value ?? learningPath.certificate_signature_png ?? '',
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

export const deleteLearningPath = async (req, res) => {
  const { id } = req.params;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
  const result = await query(
    `
      DELETE FROM learning_paths
      WHERE id = $1
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
  const { learningPathId, selectedLearners } = req.body;
  const actorPrincipalId = await resolveActorPrincipalId(req.user);
  if (!Array.isArray(selectedLearners) || selectedLearners.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'selectedLearners must be a non-empty array.');
  }

  const inserted = [];
  const insertedLearners = [];

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

  for (const learner of selectedLearners) {
    const principalId = await getOrCreateLearnerPrincipalForEnrollment(learner);
    if (!principalId) {
      continue;
    }
    const created = await query(
      `
        INSERT INTO enrollments (
          principal_id,
          learning_path_id,
          status,
          progress,
          enrolled_at,
          enrollment_source,
          employee_number,
          learner_name,
          learner_email,
          learner_designation,
          learner_grade_name
        )
        VALUES ($1, $2, 'NOT_STARTED', 0, NOW(), 'LEARNING_ADMIN', $3, $4, $5, $6, $7)
        ON CONFLICT (principal_id, learning_path_id) DO NOTHING
        RETURNING id, principal_id, learning_path_id, status, progress, enrolled_at
      `,
      [
        principalId,
        learningPathId,
        String(learner.employeeNumber || '').trim(),
        normalizeEmployeeDisplayName(learner, learner.employeeNumber),
        learner.email ? String(learner.email).trim().toLowerCase() : '',
        learner.designation ? String(learner.designation).trim() : 'Learner',
        learner.gradeName ? String(learner.gradeName).trim() : 'N/A'
      ]
    );
    if (created.rowCount > 0) {
      inserted.push(created.rows[0]);
      insertedLearners.push({
        principalId,
        employeeNumber: String(learner.employeeNumber || '').trim(),
        learnerName: normalizeEmployeeDisplayName(learner, learner.employeeNumber),
        learnerEmail: learner.email ? String(learner.email).trim().toLowerCase() : '',
        designation: learner.designation ? String(learner.designation).trim() : 'Learner',
        gradeName: learner.gradeName ? String(learner.gradeName).trim() : 'N/A'
      });
      await query(
        `
          INSERT INTO notifications (principal_id, title, message, type, is_read)
          VALUES ($1, 'Enrollment Assigned', $2, 'INFO', FALSE)
        `,
        [principalId, `You were enrolled in "${learningPath.title}".`]
      );

      sendLearningPathAssignedEmail({
        employeeNumber: String(learner.employeeNumber || '').trim(),
        to: learner.email ? String(learner.email).trim().toLowerCase() : '',
        learnerName: normalizeEmployeeDisplayName(learner, learner.employeeNumber),
        learningPathTitle: learningPath.title
      }).catch((error) => {
        console.error('LPMS learning path assignment email failed:', {
          employeeNumber: String(learner.employeeNumber || '').trim(),
          message: error.message
        });
      });
    } else {
      console.info('LPMS learning path assignment email skipped:', {
        employeeNumber: String(learner.employeeNumber || '').trim(),
        learningPathId,
        reason: 'Learner is already assigned to this learning path.'
      });
    }
  }

  if (insertedLearners.length > 0) {
    await createAssignmentReport({
      learningPathId,
      learningPathTitle: learningPath.title,
      assignedByPrincipalId: actorPrincipalId,
      assignedByName: req.user.name || 'Learning Admin',
      assignedByRole: req.user.role || 'LEARNING_ADMIN',
      assignmentSource: ASSIGNMENT_REPORT_SOURCE.LEARNING_ADMIN,
      learners: insertedLearners
    });
  }

  await logAudit({
    actorPrincipalId,
    action: 'CREATE_ENROLLMENTS',
    resourceType: 'ENROLLMENT',
    metadata: { learningPathId, inserted: inserted.length }
  });

  return res.status(201).json({ enrollments: inserted });
};

export const getAssignmentReports = async (_req, res) => {
  const result = await query(
    `
      SELECT
        ar.id,
        ar.learning_path_id,
        ar.learning_path_title,
        ar.assigned_by_name,
        ar.assigned_by_role,
        ar.assignment_source,
        ar.report_status,
        ar.assigned_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', arl.id,
              'principalId', arl.principal_id,
              'employeeNumber', arl.employee_number,
              'learnerName', arl.learner_name,
              'learnerEmail', arl.learner_email,
              'designation', arl.designation,
              'gradeName', arl.grade_name
            )
            ORDER BY arl.learner_name ASC, arl.employee_number ASC
          ) FILTER (WHERE arl.id IS NOT NULL),
          '[]'::json
        ) AS learners
      FROM assignment_reports ar
      LEFT JOIN assignment_report_learners arl ON arl.report_id = ar.id
      GROUP BY
        ar.id,
        ar.learning_path_id,
        ar.learning_path_title,
        ar.assigned_by_name,
        ar.assigned_by_role,
        ar.assignment_source,
        ar.report_status,
        ar.assigned_at
      ORDER BY ar.assigned_at DESC, ar.created_at DESC
    `
  );

  return res.status(200).json({ reports: result.rows });
};

export const updateAssignmentReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (![ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS, ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP].includes(status)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid assignment report status.');
  }

  const result = await query(
    `
      UPDATE assignment_reports
      SET report_status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, report_status
    `,
    [id, status]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Assignment report not found.');
  }

  await logAudit({
    actorPrincipalId: await resolveActorPrincipalId(req.user),
    action: 'UPDATE_ASSIGNMENT_REPORT_STATUS',
    resourceType: 'ASSIGNMENT_REPORT',
    resourceId: id,
    metadata: { status }
  });

  return res.status(200).json({ report: result.rows[0] });
};

export const getAssignableEmployeeSearchOptions = async (_req, res) => {
  try {
    const [designationsResponse, salaryGradesResponse, organizationsResponse] = await Promise.all([
      fetchAllDesignations(),
      fetchAllSalaryGrades(),
      fetchOrganizationList()
    ]);

    return res.status(200).json({
      designations: normalizeOptionList(designationsResponse?.data, 'designation'),
      grades: normalizeOptionList(salaryGradesResponse?.data, 'salaryGrade'),
      organizations: (Array.isArray(organizationsResponse?.data) ? organizationsResponse.data : [])
        .map((row) => ({
          organizationId: String(row?.organizationId || '').trim(),
          organizationName: String(row?.organizationName || '').trim(),
          parentOrganizationId: String(row?.parentOrganizationId || '').trim(),
          parentOrganizationName: String(row?.parentOrganizationName || '').trim()
        }))
        .filter((row) => row.organizationId && row.organizationName)
        .sort((a, b) => a.organizationName.localeCompare(b.organizationName)),
      payrolls: [
        { value: 'EXECUTIVE', label: 'Executive' },
        { value: 'NON_EXECUTIVE', label: 'Non Executive' }
      ]
    });
  } catch (error) {
    return sendError(
      res,
      getSearchErrorStatus(error),
      'ERP_REQUEST_FAILED',
      'Failed to load ERP filter options.',
      error.details || error.message
    );
  }
};

export const searchAssignableEmployees = async (req, res) => {
  const employeeNo = String(req.body.employeeNo || '').trim();
  const surname = String(req.body.surname || '').trim();
  const designation = String(req.body.designation || '').trim();
  const grade = String(req.body.grade || '').trim();
  const organizationName = String(req.body.organizationName || req.body.organizationId || '').trim();
  const payrollType = String(req.body.payrollType || '').trim().toUpperCase();

  if (!employeeNo && !surname && !designation && !grade && !organizationName && !payrollType) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'At least one search or filter value is required.');
  }

  const calls = [];
  if (employeeNo) {
    calls.push(fetchEmployeeDetailsForServiceNo(employeeNo));
  }
  if (surname) {
    calls.push(fetchEmployeesByPartialName(surname));
  }
  if (designation || grade || organizationName || payrollType) {
    const payroll =
      payrollType === 'EXECUTIVE'
        ? EXECUTIVE_PAYROLL
        : payrollType === 'NON_EXECUTIVE'
          ? NON_EXECUTIVE_PAYROLL
          : ALL_PAYROLLS_FILTER;

    calls.push(
      fetchEmployeesByFilters({
        designation: designation || ALL_DESIGNATIONS_FILTER,
        gradeName: grade || ALL_GRADES_FILTER,
        orgName: organizationName || ALL_ORGANIZATIONS_FILTER,
        payroll
      })
    );
  }

  try {
    const responses = await Promise.all(calls);
    const employeeMaps = responses.map((response) => {
      const map = new Map();
      for (const row of Array.isArray(response?.data) ? response.data : []) {
        const normalized = normalizeEmployeeRow(row);
        if (!normalized.employeeNumber) {
          continue;
        }
        map.set(normalized.employeeNumber, normalized);
      }
      return map;
    });

    const intersection = new Map();
    if (employeeMaps.length > 0) {
      for (const [employeeNumber, employee] of employeeMaps[0].entries()) {
        let merged = employee;
        let foundInAll = true;
        for (let index = 1; index < employeeMaps.length; index += 1) {
          const next = employeeMaps[index].get(employeeNumber);
          if (!next) {
            foundInAll = false;
            break;
          }
          merged = mergeEmployeeRows(merged, next);
        }
        if (foundInAll) {
          intersection.set(employeeNumber, merged);
        }
      }
    }

    const employees = Array.from(intersection.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );
    const learningAdminAssignments = await mapLearningAdminAssignments(employees);
    const employeesWithAssignments = employees.map((employee) => ({
      ...employee,
      isLearningAdmin: learningAdminAssignments.has(employee.employeeNumber)
    }));

    await logAudit({
      actorPrincipalId: await resolveActorPrincipalId(req.user),
      action: 'SEARCH_ASSIGNABLE_ERP_EMPLOYEES',
      resourceType: 'ERP',
      metadata: {
        employeeNo: employeeNo || null,
        surname: surname || null,
        designation: designation || null,
        grade: grade || null,
        organizationName: organizationName || null,
        payrollType: payrollType || null,
        matched: employeesWithAssignments.length
      }
    });

    return res.status(200).json({ employees: employeesWithAssignments });
  } catch (error) {
    return sendError(
      res,
      getSearchErrorStatus(error),
      'ERP_REQUEST_FAILED',
      'Failed to search ERP employees.',
      error.details || error.message
    );
  }
};

export const getClassAssignmentOptions = async (req, res) => {
  const { id } = req.params;

  const pathResult = await query(
    `
      SELECT id, title, description, status
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

  const usesCourseReferenceTable =
    (await hasTable('courses')) &&
    (await hasColumn('stage_courses', 'course_id'));

  const courseResult = await query(
    usesCourseReferenceTable
      ? `
          SELECT DISTINCT ON (c.code)
            c.id AS course_id,
            c.code AS course_code,
            c.title AS course_title,
            lps.title AS stage_title,
            lps.stage_order,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          JOIN courses c ON c.id = sc.course_id
          WHERE lps.learning_path_id = $1
          ORDER BY c.code, lps.stage_order ASC, sc.course_order ASC
        `
      : `
          SELECT DISTINCT ON (COALESCE(sc.course_code, sc.course_title))
            COALESCE(sc.course_code, sc.course_title) AS course_id,
            COALESCE(sc.course_code, sc.course_title) AS course_code,
            sc.course_title,
            lps.title AS stage_title,
            lps.stage_order,
            sc.course_order
          FROM learning_path_stages lps
          JOIN stage_courses sc ON sc.stage_id = lps.id
          WHERE lps.learning_path_id = $1
          ORDER BY COALESCE(sc.course_code, sc.course_title), lps.stage_order ASC, sc.course_order ASC
        `,
    [id]
  );

  const learnerResult = await query(
    `
      SELECT
        en.id AS enrollment_id,
        en.status,
        en.progress,
        en.enrolled_at,
        ap.id AS principal_id,
        ap.name,
        ap.email,
        e.employee_number,
        e.designation,
        e.grade_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ce.id,
              'courseCode', ce.course_code,
              'classId', ce.class_id,
              'classCode', ce.class_code,
              'classTitle', ce.class_title,
              'classPayload', ce.class_payload,
              'assignedAt', ce.assigned_at
            )
            ORDER BY ce.assigned_at DESC
          ) FILTER (WHERE ce.id IS NOT NULL),
          '[]'::json
        ) AS class_assignments
      FROM enrollments en
      JOIN auth_principals ap ON ap.id = en.principal_id
      LEFT JOIN employees e ON e.principal_id = ap.id
      LEFT JOIN class_enrollments ce ON ce.enrollment_id = en.id
      WHERE en.learning_path_id = $1
      GROUP BY
        en.id,
        en.status,
        en.progress,
        en.enrolled_at,
        ap.id,
        ap.name,
        ap.email,
        e.employee_number,
        e.designation,
        e.grade_name
      ORDER BY ap.name ASC, e.employee_number ASC
    `,
    [id]
  );

  return res.status(200).json({
    learningPath,
    courses: courseResult.rows.map((row) => ({
      courseId: row.course_id,
      courseCode: row.course_code,
      title: row.course_title || row.course_code,
      stageTitle: row.stage_title,
      stageOrder: row.stage_order,
      order: row.course_order
    })),
    learners: learnerResult.rows.map((row) => ({
      enrollmentId: row.enrollment_id,
      principalId: row.principal_id,
      employeeNumber: row.employee_number,
      name: row.name,
      email: row.email,
      designation: row.designation,
      gradeName: row.grade_name,
      status: row.status,
      progress: Number(row.progress || 0),
      enrolledAt: row.enrolled_at,
      classAssignments: row.class_assignments || []
    }))
  });
};

export const getClassesByCourseCode = async (req, res) => {
  const courseCode = String(req.params.courseCode || '').trim();
  if (!courseCode) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Course code is required.');
  }

  try {
    const response = await fetchClassesByCourseCode(courseCode);
    const rows = Array.isArray(response?.data) ? response.data : [];
    return res.status(200).json({
      courseCode,
      classes: rows.map(normalizeErpClassRow)
    });
  } catch (error) {
    return sendError(
      res,
      getSearchErrorStatus(error),
      'ERP_REQUEST_FAILED',
      'Failed to load ERP classes for this course.',
      error.details || error.message
    );
  }
};

export const assignClassEnrollments = async (req, res) => {
  const learningPathId = String(req.body.learningPathId || '').trim();
  const courseCode = String(req.body.courseCode || '').trim();
  const selectedEnrollmentIds = Array.isArray(req.body.enrollmentIds)
    ? req.body.enrollmentIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const selectedClass = req.body.class || {};
  const classId = String(selectedClass.id || selectedClass.classId || '').trim();
  const classCode = String(selectedClass.code || selectedClass.classCode || classId).trim();
  const classTitle = String(selectedClass.title || selectedClass.classTitle || classCode || classId).trim();

  if (!learningPathId || !courseCode || !classId || selectedEnrollmentIds.length === 0) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'learningPathId, courseCode, class, and enrollmentIds are required.'
    );
  }

  const pathResult = await query(
    `
      SELECT id, title
      FROM learning_paths
      WHERE id = $1 AND is_deleted = FALSE
      LIMIT 1
    `,
    [learningPathId]
  );
  if (pathResult.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Learning path not found.');
  }

  const learningPath = pathResult.rows[0];

  const validEnrollments = await query(
    `
      SELECT
        en.id,
        COALESCE(NULLIF(en.learner_name, ''), ap.name) AS name,
        COALESCE(NULLIF(en.learner_email, ''), NULLIF(latest_report.learner_email, ''), ap.email) AS email,
        e.employee_number
      FROM enrollments en
      JOIN auth_principals ap ON ap.id = en.principal_id
      LEFT JOIN employees e ON e.principal_id = ap.id
      LEFT JOIN LATERAL (
        SELECT arl.learner_email
        FROM assignment_reports ar
        JOIN assignment_report_learners arl ON arl.report_id = ar.id
        WHERE ar.learning_path_id = en.learning_path_id
          AND arl.employee_number = e.employee_number
        ORDER BY ar.assigned_at DESC, ar.created_at DESC
        LIMIT 1
      ) latest_report ON TRUE
      WHERE en.learning_path_id = $1
        AND en.id = ANY($2::uuid[])
    `,
    [learningPathId, selectedEnrollmentIds]
  );

  if (validEnrollments.rowCount === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'No selected learners belong to this learning path.');
  }

  const actorPrincipalId = await resolveActorPrincipalId(req.user);
  const assigned = [];
  for (const row of validEnrollments.rows) {
    const result = await query(
      `
        INSERT INTO class_enrollments (
          enrollment_id,
          learning_path_id,
          course_code,
          class_id,
          class_code,
          class_title,
          class_payload,
          assigned_by,
          assigned_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW(), NOW())
        ON CONFLICT (enrollment_id, course_code)
        DO UPDATE SET
          class_id = EXCLUDED.class_id,
          class_code = EXCLUDED.class_code,
          class_title = EXCLUDED.class_title,
          class_payload = EXCLUDED.class_payload,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = NOW(),
          updated_at = NOW()
        RETURNING id, enrollment_id, course_code, class_id, class_code, class_title, assigned_at
      `,
      [
        row.id,
        learningPathId,
        courseCode,
        classId,
        classCode || null,
        classTitle || null,
        JSON.stringify(selectedClass),
        actorPrincipalId
      ]
    );
    assigned.push(result.rows[0]);

    sendClassAssignedEmail({
      employeeNumber: String(row.employee_number || '').trim(),
      to: row.email ? String(row.email).trim().toLowerCase() : '',
      learnerName: row.name,
      learningPathTitle: learningPath.title,
      courseCode,
      classTitle,
      classCode
    }).catch((error) => {
      console.error('LPMS class assignment email failed:', {
        employeeNumber: String(row.employee_number || '').trim(),
        message: error.message
      });
    });
  }

  await logAudit({
    actorPrincipalId,
    action: 'ASSIGN_CLASS_ENROLLMENTS',
    resourceType: 'CLASS_ENROLLMENT',
    metadata: {
      learningPathId,
      courseCode,
      classId,
      assigned: assigned.length,
      requested: selectedEnrollmentIds.length
    }
  });

  return res.status(201).json({ assigned });
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
