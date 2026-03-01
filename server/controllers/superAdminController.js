import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { ALL_ROLES, ROLES } from '../constants/roles.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';

const createPrincipal = async ({ email, password, role, name, principalType = 'USER' }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `
      INSERT INTO auth_principals (email, password_hash, role, name, principal_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, role, name, principal_type, created_at
    `,
    [email, passwordHash, role, name, principalType]
  );

  return result.rows[0];
};

export const createUser = async (req, res) => {
  const { email, password, role, name } = req.body;

  if (!ALL_ROLES.includes(role)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid role.', {
      allowedRoles: ALL_ROLES
    });
  }

  if (role !== ROLES.SUPER_ADMIN && role !== ROLES.LEARNING_ADMIN) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Only SUPER_ADMIN and LEARNING_ADMIN accounts can be created from this interface.'
    );
  }

  const created = await createPrincipal({
    email,
    password,
    role,
    name: name || email.split('@')[0]
  });

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'CREATE_USER',
    resourceType: 'AUTH_PRINCIPAL',
    resourceId: created.id,
    metadata: { role: created.role, email: created.email }
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
    `
  );

  return res.status(200).json({ users: result.rows });
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'You cannot deactivate your own account.');
  }

  const target = await query(
    `
      SELECT id, role
      FROM auth_principals
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  if (target.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found.');
  }
  if (!['SUPER_ADMIN', 'LEARNING_ADMIN'].includes(target.rows[0].role)) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Only SUPER_ADMIN and LEARNING_ADMIN accounts can be deactivated from this interface.'
    );
  }

  const result = await query(
    `
      UPDATE auth_principals
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, role, name, principal_type, is_active, updated_at
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found.');
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'DEACTIVATE_USER',
    resourceType: 'AUTH_PRINCIPAL',
    resourceId: result.rows[0].id
  });

  return res.status(200).json({ user: result.rows[0] });
};

export const getAllLearners = async (_req, res) => {
  const result = await query(
    `
      SELECT
        ap.id AS principal_id,
        ap.name,
        ap.email,
        ap.is_active,
        e.employee_number,
        e.designation,
        e.grade_name,
        COUNT(en.id)::int AS total_learning_paths,
        COUNT(en.id) FILTER (WHERE en.status = 'COMPLETED')::int AS completed_learning_paths,
        COALESCE(AVG(en.progress), 0)::numeric(5,2) AS average_progress
      FROM auth_principals ap
      JOIN employees e ON e.principal_id = ap.id
      LEFT JOIN enrollments en ON en.principal_id = ap.id
      WHERE ap.role = 'EMPLOYEE'
      GROUP BY ap.id, ap.name, ap.email, ap.is_active, e.employee_number, e.designation, e.grade_name
      ORDER BY ap.name ASC
    `
  );

  return res.status(200).json({ learners: result.rows });
};

export const getLearnerLearningPaths = async (req, res) => {
  const { principalId } = req.params;

  const principal = await query(
    `
      SELECT id, name, email, role
      FROM auth_principals
      WHERE id = $1
      LIMIT 1
    `,
    [principalId]
  );
  if (principal.rowCount === 0 || principal.rows[0].role !== 'EMPLOYEE') {
    return sendError(res, 404, 'NOT_FOUND', 'Learner not found.');
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
    [principalId]
  );

  return res.status(200).json({
    learner: {
      id: principal.rows[0].id,
      name: principal.rows[0].name,
      email: principal.rows[0].email
    },
    learningPaths: result.rows
  });
};

export const createEmployee = async (req, res) => {
  const { employeeNumber, email, password, designation, gradeName, name, supervisorId } = req.body;

  const existingEmployee = await query(
    `
      SELECT id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [employeeNumber]
  );

  if (existingEmployee.rowCount > 0) {
    return sendError(res, 409, 'CONFLICT', 'Employee number already exists.');
  }

  const principal = await createPrincipal({
    email,
    password,
    role: ROLES.EMPLOYEE,
    name: name || email.split('@')[0],
    principalType: 'EMPLOYEE'
  });

  const employeeResult = await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, principal_id, employee_number, designation, grade_name, supervisor_id, created_at
    `,
    [principal.id, employeeNumber, designation, gradeName, supervisorId || null]
  );

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'CREATE_EMPLOYEE',
    resourceType: 'EMPLOYEE',
    resourceId: employeeResult.rows[0].id,
    metadata: { principalId: principal.id }
  });

  return res.status(201).json({
    user: principal,
    employee: employeeResult.rows[0]
  });
};
