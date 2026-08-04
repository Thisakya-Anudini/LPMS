import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { ALL_ROLES, ROLES } from "../constants/roles.js";
import { sendError } from "../utils/http.js";
import { logAudit } from "../utils/audit.js";
import { fetchEmployeeDetailsForServiceNo } from "../utils/erpClient.js";

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
    [tableName],
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
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.present);
};

const createPrincipal = async ({
  email,
  password,
  role,
  name,
  principalType = "USER",
}) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `
      INSERT INTO auth_principals (email, password_hash, role, name, principal_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, role, name, principal_type, created_at
    `,
    [email, passwordHash, role, name, principalType],
  );

  return result.rows[0];
};

const normalizeEmployeeDisplayName = (row, employeeNo) => {
  if (row?.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }
  const initials = row?.employeeInitials
    ? String(row.employeeInitials).trim()
    : "";
  const surname = row?.employeeSurname
    ? String(row.employeeSurname).trim()
    : "";
  const merged = `${initials} ${surname}`.trim();
  return merged || `Learner ${employeeNo}`;
};

const getOrCreateEmployeePrincipal = async (employee) => {
  const employeeNumber = String(
    employee?.employeeNumber || employee?.employee_number || "",
  ).trim();
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
    [employeeNumber],
  );
  if (existingEmployee.rowCount > 0) {
    return existingEmployee.rows[0].principal_id;
  }

  let employeeRow = employee;
  if (!employeeRow || Object.keys(employeeRow).length === 0) {
    try {
      const detailsResponse =
        await fetchEmployeeDetailsForServiceNo(employeeNumber);
      employeeRow = detailsResponse?.data?.[0] || null;
    } catch {
      employeeRow = null;
    }
  }

  const fallbackDomain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || "erp.local";
  const email =
    employeeRow?.email && String(employeeRow.email).trim()
      ? String(employeeRow.email).trim().toLowerCase()
      : `${employeeNumber}@${fallbackDomain}`;
  const name = normalizeEmployeeDisplayName(employeeRow, employeeNumber);
  const designation =
    employeeRow?.designation && String(employeeRow.designation).trim()
      ? String(employeeRow.designation).trim()
      : "Learner";
  const gradeName =
    employeeRow?.gradeName && String(employeeRow.gradeName).trim()
      ? String(employeeRow.gradeName).trim()
      : "N/A";

  let principalId = null;
  const existingPrincipal = await query(
    `
      SELECT ap.id, e.employee_number
      FROM auth_principals ap
      LEFT JOIN employees e ON e.principal_id = ap.id
      WHERE ap.email = $1
      LIMIT 1
    `,
    [email],
  );

  if (existingPrincipal.rowCount > 0) {
    const matchedEmployeeNumber = String(
      existingPrincipal.rows[0].employee_number || "",
    ).trim();
    if (!matchedEmployeeNumber || matchedEmployeeNumber === employeeNumber) {
      principalId = existingPrincipal.rows[0].id;
    }
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
        [principalEmail],
      );

      if (fallbackPrincipal.rowCount === 0) {
        break;
      }

      const fallbackEmployeeNumber = String(
        fallbackPrincipal.rows[0].employee_number || "",
      ).trim();
      if (
        !fallbackEmployeeNumber ||
        fallbackEmployeeNumber === employeeNumber
      ) {
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
      [principalEmail, passwordHash, name],
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
      [principalId],
    );
    const currentPrincipalEmail = String(principalResult.rows[0]?.email || "")
      .trim()
      .toLowerCase();
    const usesFallbackEmail =
      currentPrincipalEmail.endsWith(`@${fallbackDomain}`) ||
      (currentPrincipalEmail.includes("+") &&
        currentPrincipalEmail.endsWith(`@${fallbackDomain}`));

    if (usesFallbackEmail && currentPrincipalEmail !== email) {
      const emailOwner = await query(
        `
          SELECT id
          FROM auth_principals
          WHERE email = $1
          LIMIT 1
        `,
        [email],
      );

      if (emailOwner.rowCount === 0 || emailOwner.rows[0].id === principalId) {
        await query(
          `
            UPDATE auth_principals
            SET email = $2
            WHERE id = $1
          `,
          [principalId, email],
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
    [principalId],
  );

  if (existingEmployeeForPrincipal.rowCount > 0) {
    await query(
      `
        UPDATE employees
        SET designation = $2, grade_name = $3, updated_at = NOW()
        WHERE principal_id = $1
      `,
      [principalId, designation, gradeName],
    );
    return principalId;
  }

  await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, NULL)
      ON CONFLICT (employee_number) DO NOTHING
    `,
    [principalId, employeeNumber, designation, gradeName],
  );

  return principalId;
};

export const createUser = async (req, res) => {
  const { email, password, role, name } = req.body;
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    return sendError(res, 400, "VALIDATION_ERROR", "Name cannot be blank.");
  }

  if (!/^[A-Za-z\s]+$/.test(normalizedName)) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Only letters and spaces are allowed for name.",
    );
  }

  if (!ALL_ROLES.includes(role)) {
    return sendError(res, 400, "VALIDATION_ERROR", "Invalid role.", {
      allowedRoles: ALL_ROLES,
    });
  }

  if (role !== ROLES.SUPER_ADMIN) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Only SUPER_ADMIN accounts can be created from this interface.",
    );
  }

  const created = await createPrincipal({
    email,
    password,
    role,
    name: normalizedName,
  });

  await logAudit({
    actorPrincipalId: req.user.id,
    action: "CREATE_USER",
    resourceType: "AUTH_PRINCIPAL",
    resourceId: created.id,
    metadata: { role: created.role, email: created.email },
  });

  return res.status(201).json({ user: created });
};

export const getAllUsers = async (_req, res) => {
  const result = await query(
    `
      SELECT id, email, role, name, principal_type, is_active, created_at
      FROM auth_principals
      WHERE role IN ('SUPER_ADMIN', 'LEARNING_ADMIN')
      ORDER BY created_at DESC
    `,
  );

  return res.status(200).json({ users: result.rows });
};

export const getAssignedLearningAdmins = async (_req, res) => {
  const result = await query(
    `
      SELECT
        la.employee_number,
        la.assigned_by_principal_id,
        la.created_at,
        la.updated_at,
        e.principal_id,
        e.designation,
        e.grade_name,
        ap.name,
        ap.email,
        ap.is_active
      FROM learning_admin_assignments la
      JOIN employees e ON e.employee_number = la.employee_number
      JOIN auth_principals ap ON ap.id = e.principal_id
      ORDER BY la.updated_at DESC, ap.name ASC
    `,
  );

  const admins = result.rows;

  const enrichedAdmins = await Promise.all(
    admins.map(async (admin) => {
      try {
        if (admin.employee_number) {
          const erpResponse = await fetchEmployeeDetailsForServiceNo(
            admin.employee_number,
          );
          const erpData = erpResponse?.data?.[0];

          if (erpData && erpData.email && String(erpData.email).trim()) {
            admin.email = String(erpData.email).trim().toLowerCase();
          }
        }
      } catch (err) {
        // silently fallback to the local DB email
      }
      return admin;
    }),
  );

  return res.status(200).json({ learningAdmins: enrichedAdmins });
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "You cannot delete your own account.",
    );
  }

  const target = await query(
    `
      SELECT id, role
      FROM auth_principals
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  if (target.rowCount === 0) {
    return sendError(res, 404, "NOT_FOUND", "User not found.");
  }
  if (!["SUPER_ADMIN", "LEARNING_ADMIN"].includes(target.rows[0].role)) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Only SUPER_ADMIN and LEARNING_ADMIN accounts can be deleted from this interface.",
    );
  }

  const result = await query(
    `
      DELETE FROM auth_principals
      WHERE id = $1
      RETURNING id, email, role, name, principal_type
    `,
    [id],
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, "NOT_FOUND", "User not found.");
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: "DEACTIVATE_USER",
    resourceType: "AUTH_PRINCIPAL",
    resourceId: result.rows[0].id,
  });

  return res.status(200).json({ user: result.rows[0] });
};

export const assignLearningAdmin = async (req, res) => {
  const { employeeNumber } = req.body;
  const normalizedEmployeeNumber = String(employeeNumber || "").trim();
  if (!normalizedEmployeeNumber) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "employeeNumber is required.",
    );
  }

  let employee = await query(
    `
      SELECT
        e.employee_number,
        e.principal_id,
        ap.name,
        ap.email,
        ap.is_active
      FROM employees e
      JOIN auth_principals ap ON ap.id = e.principal_id
      WHERE e.employee_number = $1
      LIMIT 1
    `,
    [normalizedEmployeeNumber],
  );

  if (employee.rowCount === 0) {
    const principalId = await getOrCreateEmployeePrincipal(
      req.body.employee || { employeeNumber: normalizedEmployeeNumber },
    );
    if (!principalId) {
      return sendError(
        res,
        404,
        "NOT_FOUND",
        "Learner not found for given employeeNumber.",
      );
    }

    employee = await query(
      `
        SELECT
          e.employee_number,
          e.principal_id,
          ap.name,
          ap.email,
          ap.is_active
        FROM employees e
        JOIN auth_principals ap ON ap.id = e.principal_id
        WHERE e.employee_number = $1
        LIMIT 1
      `,
      [normalizedEmployeeNumber],
    );
    if (employee.rowCount === 0) {
      return sendError(
        res,
        404,
        "NOT_FOUND",
        "Learner not found for given employeeNumber.",
      );
    }
  }

  if (!employee.rows[0].is_active) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Learner account is inactive.",
    );
  }

  await query(
    `
      INSERT INTO learning_admin_assignments (employee_number, assigned_by_principal_id)
      VALUES ($1, $2)
      ON CONFLICT (employee_number)
      DO UPDATE SET assigned_by_principal_id = EXCLUDED.assigned_by_principal_id, updated_at = NOW()
    `,
    [normalizedEmployeeNumber, req.user.id],
  );

  await logAudit({
    actorPrincipalId: req.user.id,
    action: "ASSIGN_LEARNING_ADMIN",
    resourceType: "EMPLOYEE",
    resourceId: employee.rows[0].principal_id,
    metadata: { employeeNumber: normalizedEmployeeNumber },
  });

  let enrichedEmail = employee.rows[0].email;
  try {
    const erpResponse = await fetchEmployeeDetailsForServiceNo(
      normalizedEmployeeNumber,
    );
    const erpData = erpResponse?.data?.[0];

    if (erpData && erpData.email && String(erpData.email).trim()) {
      enrichedEmail = String(erpData.email).trim().toLowerCase();
    }
  } catch (err) {
    // Silently fallback to the local DB email
  }

  return res.status(200).json({
    assignment: {
      employeeNumber: normalizedEmployeeNumber,
      principalId: employee.rows[0].principal_id,
      name: employee.rows[0].name,
      email: enrichedEmail,
      isLearningAdmin: true,
    },
  });
};

export const removeLearningAdmin = async (req, res) => {
  const normalizedEmployeeNumber = String(
    req.params.employeeNumber || "",
  ).trim();
  if (!normalizedEmployeeNumber) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "employeeNumber is required.",
    );
  }

  const result = await query(
    `
      DELETE FROM learning_admin_assignments
      WHERE employee_number = $1
      RETURNING employee_number
    `,
    [normalizedEmployeeNumber],
  );

  if (result.rowCount === 0) {
    return sendError(
      res,
      404,
      "NOT_FOUND",
      "Learning admin assignment not found.",
    );
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: "REMOVE_LEARNING_ADMIN",
    resourceType: "EMPLOYEE",
    resourceId: normalizedEmployeeNumber,
    metadata: { employeeNumber: normalizedEmployeeNumber },
  });

  return res.status(200).json({ success: true });
};

export const getAllLearners = async (req, res) => {
  const rawPage = Number.parseInt(String(req.query.page || "1"), 10);
  const rawPageSize = Number.parseInt(String(req.query.pageSize || "25"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(rawPageSize, 1), 100)
    : 25;
  const offset = (page - 1) * pageSize;

  const employeeNo = String(req.query.employeeNo || "").trim();
  const name = String(req.query.name || "").trim();
  const designation = String(req.query.designation || "ALL").trim();

  const whereClauses = [`ap.role = 'EMPLOYEE'`];
  const queryParams = [];

  if (employeeNo) {
    queryParams.push(`%${employeeNo}%`);
    whereClauses.push(`e.employee_number ILIKE $${queryParams.length}`);
  }

  if (name) {
    queryParams.push(`%${name}%`);
    whereClauses.push(`ap.name ILIKE $${queryParams.length}`);
  }

  if (designation && designation !== "ALL") {
    queryParams.push(designation);
    whereClauses.push(`e.designation = $${queryParams.length}`);
  }

  const whereSql = whereClauses.join(" AND ");

  const [countResult, learnersResult, designationResult] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM auth_principals ap
        JOIN employees e ON e.principal_id = ap.id
        WHERE ${whereSql}
      `,
      queryParams,
    ),
    query(
      `
        WITH filtered_learners AS (
          SELECT
            ap.id AS principal_id,
            ap.name,
            ap.email,
            ap.is_active,
            e.employee_number,
            e.designation,
            e.grade_name
          FROM auth_principals ap
          JOIN employees e ON e.principal_id = ap.id
          WHERE ${whereSql}
          ORDER BY ap.name ASC
          LIMIT $${queryParams.length + 1}
          OFFSET $${queryParams.length + 2}
        )
        SELECT
          fl.principal_id,
          fl.name,
          fl.email,
          fl.is_active,
          fl.employee_number,
          fl.designation,
          fl.grade_name,
          (la.employee_number IS NOT NULL) AS is_learning_admin,
          COUNT(en.id)::int AS total_learning_paths,
          COUNT(en.id) FILTER (WHERE en.status = 'COMPLETED')::int AS completed_learning_paths,
          COALESCE(AVG(en.progress), 0)::numeric(5,2) AS average_progress
        FROM filtered_learners fl
        LEFT JOIN learning_admin_assignments la ON la.employee_number = fl.employee_number
        LEFT JOIN enrollments en ON en.principal_id = fl.principal_id
        GROUP BY
          fl.principal_id,
          fl.name,
          fl.email,
          fl.is_active,
          fl.employee_number,
          fl.designation,
          fl.grade_name,
          la.employee_number
        ORDER BY fl.name ASC
      `,
      [...queryParams, pageSize, offset],
    ),
    query(
      `
        SELECT DISTINCT e.designation
        FROM auth_principals ap
        JOIN employees e ON e.principal_id = ap.id
        WHERE ap.role = 'EMPLOYEE'
          AND COALESCE(TRIM(e.designation), '') <> ''
        ORDER BY e.designation ASC
      `,
    ),
  ]);

  const total = countResult.rows[0]?.total || 0;
  const learners = learnersResult.rows;

  const enrichedLearners = await Promise.all(
    learners.map(async (learner) => {
      try {
        if (learner.employee_number) {
          const erpResponse = await fetchEmployeeDetailsForServiceNo(
            learner.employee_number,
          );
          const erpData = erpResponse?.data?.[0];

          if (erpData && erpData.email && String(erpData.email).trim()) {
            learner.email = String(erpData.email).trim().toLowerCase();
          }
        }
      } catch (err) {
        // Silently fallback to the Local DB email if the ERP API request fails
      }
      return learner;
    }),
  );

  return res.status(200).json({
    learners: enrichedLearners,
    designationOptions: designationResult.rows.map((row) => row.designation),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
};

const sendLearnerLearningPaths = async (res, principalId) => {
  const principal = await query(
    `
    SELECT ap.id, ap.name, ap.email, ap.role, e.employee_number
    FROM auth_principals ap
    LEFT JOIN employees e ON ap.id = e.principal_id
    WHERE ap.id = $1
    LIMIT 1
    `,
    [principalId],
  );
  if (principal.rowCount === 0 || principal.rows[0].role !== "EMPLOYEE") {
    return sendError(res, 404, "NOT_FOUND", "Learner not found.");
  }

  let enrichedEmail = principal.rows[0].email;
  const employeeNumber = principal.rows[0].employee_number;

  if (employeeNumber) {
    try {
      const erpResponse =
        await fetchEmployeeDetailsForServiceNo(employeeNumber);
      const erpData = erpResponse?.data?.[0];
      if (erpData && erpData.email && String(erpData.email).trim()) {
        enrichedEmail = String(erpData.email).trim().toLowerCase();
      }
    } catch (err) {
      console.error(
        `Failed to fetch real email for learner ${employeeNumber}:`,
        err.message,
      );
      // Silently fallback to DB email if fetch fails
    }
  }

  const result = await query(
    `
    SELECT
      en.id AS enrollment_id,
      en.status,
      en.progress,
      en.enrolled_at,
      en.completed_at,
      lp.id AS learning_path_id,
      lp.title,
      lp.description,
      lp.category,
      lp.total_duration
    FROM enrollments en
    JOIN learning_paths lp ON lp.id = en.learning_path_id
    WHERE en.principal_id = $1
      AND lp.is_deleted = FALSE
    ORDER BY en.enrolled_at DESC    
    `,
    [principalId],
  );

  return res.status(200).json({
    learner: {
      id: principal.rows[0].id,
      name: principal.rows[0].name,
      email: enrichedEmail,
    },
    learningPaths: result.rows,
  });
};

export const getLearnerLearningPaths = async (req, res) => {
  const { principalId } = req.params;
  return sendLearnerLearningPaths(res, principalId);
};

export const getLearnerLearningPathsByEmployeeNo = async (req, res) => {
  const employeeNo = String(req.params.employeeNo || "").trim();
  if (!employeeNo) {
    return sendError(res, 400, "VALIDATION_ERROR", "employeeNo is required.");
  }

  const employee = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNo],
  );
  if (employee.rowCount === 0) {
    return sendError(res, 404, "NOT_FOUND", "Learner not found.");
  }

  return sendLearnerLearningPaths(res, employee.rows[0].principal_id);
};

export const getLearningPathEnrollments = async (req, res) => {
  const { learningPathId } = req.params;

  const learningPathResult = await query(
    `
      SELECT id, title, description, category, total_duration, status
      FROM learning_paths
      WHERE id = $1
        AND is_deleted = FALSE
      LIMIT 1
    `,
    [learningPathId],
  );

  if (learningPathResult.rowCount === 0) {
    return sendError(res, 404, "NOT_FOUND", "Learning path not found.");
  }

  const enrollmentsResult = await query(
    `
      SELECT
        en.id AS enrollment_id,
        en.status,
        en.progress,
        en.enrolled_at,
        en.completed_at,
        ap.id AS principal_id,
        ap.name,
        ap.email,
        e.employee_number,
        e.designation,
        e.grade_name
      FROM enrollments en
      JOIN auth_principals ap ON ap.id = en.principal_id
      JOIN employees e ON e.principal_id = ap.id
      WHERE en.learning_path_id = $1
      ORDER BY en.enrolled_at DESC, ap.name ASC
    `,
    [learningPathId],
  );

  const enrichedEnrollments = await Promise.all(
    enrollmentsResult.rows.map(async (enrollment) => {
      try {
        if (enrollment.employee_number) {
          const erpResponse = await fetchEmployeeDetailsForServiceNo(
            enrollment.employee_number,
          );
          const erpData = erpResponse?.data?.[0];

          if (erpData && erpData.email && String(erpData.email).trim()) {
            enrollment.email = String(erpData.email).trim().toLowerCase();
          }
        }
      } catch (err) {
        // Silently fallback to the Local DB email if the ERP API request fails
      }
      return enrollment;
    }),
  );

  return res.status(200).json({
    learningPath: learningPathResult.rows[0],
    enrollments: enrichedEnrollments,
  });
};

export const createEmployee = async (req, res) => {
  const {
    employeeNumber,
    email,
    password,
    designation,
    gradeName,
    name,
    supervisorId,
  } = req.body;

  const existingEmployee = await query(
    `
      SELECT id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNumber],
  );

  if (existingEmployee.rowCount > 0) {
    return sendError(res, 409, "CONFLICT", "Employee number already exists.");
  }

  const principal = await createPrincipal({
    email,
    password,
    role: ROLES.EMPLOYEE,
    name: name || email.split("@")[0],
    principalType: "EMPLOYEE",
  });

  const employeeResult = await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, principal_id, employee_number, designation, grade_name, supervisor_id, created_at
    `,
    [
      principal.id,
      employeeNumber,
      designation,
      gradeName,
      supervisorId || null,
    ],
  );

  await logAudit({
    actorPrincipalId: req.user.id,
    action: "CREATE_EMPLOYEE",
    resourceType: "EMPLOYEE",
    resourceId: employeeResult.rows[0].id,
    metadata: { principalId: principal.id },
  });

  return res.status(201).json({
    user: principal,
    employee: employeeResult.rows[0],
  });
};

export const getEnrollmentCourses = async (req, res) => {
  const { enrollmentId } = req.params;

  try {
    // Dynamically determine the database schema
    const useCourseReference =
      (await hasTable("courses")) &&
      (await hasColumn("stage_courses", "course_id")) &&
      (await hasColumn("enrollment_progress", "course_id"));

    const coursesResult = await query(
      useCourseReference
        ? `
            SELECT 
              COALESCE(course.id, lps.id) AS "courseId",
              COALESCE(course.title, lps.title) AS title,
              COALESCE(sc.course_order, lps.stage_order) AS "order",
              lps.title AS "stageTitle",
              lps.stage_order AS "stageOrder",
              COALESCE(ep.progress, 0) AS progress,
              CASE WHEN COALESCE(ep.progress, 0) >= 100 THEN true ELSE false END AS "isCompleted"
            FROM enrollments en
            JOIN learning_path_stages lps ON lps.learning_path_id = en.learning_path_id
            LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
            LEFT JOIN courses course ON course.id = sc.course_id
            LEFT JOIN enrollment_progress ep 
              ON ep.enrollment_id = en.id 
              AND (
                ep.course_id = course.id
                OR (course.id IS NULL AND ep.stage_id = lps.id)
              )
            WHERE en.id = $1
            ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
          `
        : `
            SELECT 
              COALESCE(sc.course_code, lps.id::text) AS "courseId",
              COALESCE(sc.course_title, lps.title) AS title,
              COALESCE(sc.course_order, lps.stage_order) AS "order",
              lps.title AS "stageTitle",
              lps.stage_order AS "stageOrder",
              COALESCE(ep.progress, 0) AS progress,
              CASE WHEN COALESCE(ep.progress, 0) >= 100 THEN true ELSE false END AS "isCompleted"
            FROM enrollments en
            JOIN learning_path_stages lps ON lps.learning_path_id = en.learning_path_id
            LEFT JOIN stage_courses sc ON sc.stage_id = lps.id
            LEFT JOIN enrollment_progress ep 
              ON ep.enrollment_id = en.id 
              AND (
                ep.course_code = sc.course_code 
                OR (sc.course_code IS NULL AND ep.stage_id = lps.id)
              )
            WHERE en.id = $1
            ORDER BY lps.stage_order ASC, COALESCE(sc.course_order, lps.stage_order) ASC
          `,
      [enrollmentId],
    );

    return res.status(200).json({ courses: coursesResult.rows });
  } catch (error) {
    console.error("Failed to fetch enrollment courses for super admin:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      `Database Error: ${error.message}`,
    );
  }
};
