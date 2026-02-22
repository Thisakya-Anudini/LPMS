import { fetchEmployeeSubordinates } from '../utils/erpClient.js';
import { sendError } from '../utils/http.js';
import { logAudit } from '../utils/audit.js';
import { query } from '../db.js';
import bcrypt from 'bcryptjs';

export const getErpSubordinates = async (req, res) => {
  const { employeeNo } = req.body;
  if (!employeeNo || typeof employeeNo !== 'string') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employeeNo is required.');
  }

  try {
    const data = await fetchEmployeeSubordinates(employeeNo.trim());

    await logAudit({
      actorPrincipalId: req.user.id,
      action: 'FETCH_ERP_SUBORDINATES',
      resourceType: 'ERP',
      metadata: { employeeNo }
    });

    return res.status(200).json({
      source: 'ERP',
      employeeNo,
      data
    });
  } catch (error) {
    const status = typeof error.status === 'number' ? error.status : 502;
    return sendError(
      res,
      status,
      'ERP_REQUEST_FAILED',
      'Failed to fetch subordinate details from ERP.',
      error.details || error.message
    );
  }
};

const normalizeName = (employee) => {
  if (employee.employeeName && String(employee.employeeName).trim()) {
    return String(employee.employeeName).trim();
  }

  const initials = employee.employeeInitials ? String(employee.employeeInitials).trim() : '';
  const surname = employee.employeeSurname ? String(employee.employeeSurname).trim() : '';
  const fallback = `${initials} ${surname}`.trim();
  return fallback || `Employee ${employee.employeeNumber}`;
};

const normalizeEmail = (employee) => {
  const rawEmail = employee.email ? String(employee.email).trim().toLowerCase() : '';
  if (rawEmail) {
    return rawEmail;
  }

  const domain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || 'erp.local';
  return `${String(employee.employeeNumber).trim()}@${domain}`;
};

export const importErpEmployees = async (req, res) => {
  const { employees, supervisorId } = req.body;
  if (!Array.isArray(employees) || employees.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'employees must be a non-empty array.');
  }

  const defaultPassword = process.env.ERP_IMPORTED_DEFAULT_PASSWORD || 'ChangeMe@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const imported = [];
  const skipped = [];

  for (const employee of employees) {
    const employeeNumber = employee?.employeeNumber ? String(employee.employeeNumber).trim() : '';
    if (!employeeNumber) {
      skipped.push({ employeeNumber: null, reason: 'Missing employeeNumber' });
      continue;
    }

    const existingEmployee = await query(
      'SELECT id FROM employees WHERE employee_number = $1 LIMIT 1',
      [employeeNumber]
    );
    if (existingEmployee.rowCount > 0) {
      skipped.push({ employeeNumber, reason: 'Employee number already exists' });
      continue;
    }

    const email = normalizeEmail(employee);
    const existingPrincipal = await query(
      'SELECT id FROM auth_principals WHERE email = $1 LIMIT 1',
      [email]
    );
    if (existingPrincipal.rowCount > 0) {
      skipped.push({ employeeNumber, reason: 'Email already exists in auth principals' });
      continue;
    }

    const name = normalizeName(employee);
    const designation = employee.designation ? String(employee.designation).trim() : 'Employee';
    const gradeName = employee.gradeName ? String(employee.gradeName).trim() : 'N/A';

    const principalInsert = await query(
      `
        INSERT INTO auth_principals (email, password_hash, role, name, principal_type, must_change_password)
        VALUES ($1, $2, 'EMPLOYEE', $3, 'EMPLOYEE', TRUE)
        RETURNING id, email, name
      `,
      [email, passwordHash, name]
    );
    const principal = principalInsert.rows[0];

    const employeeInsert = await query(
      `
        INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, employee_number
      `,
      [principal.id, employeeNumber, designation, gradeName, supervisorId || null]
    );

    imported.push({
      employeeNumber,
      principalId: principal.id,
      employeeId: employeeInsert.rows[0].id,
      email: principal.email
    });
  }

  await logAudit({
    actorPrincipalId: req.user.id,
    action: 'IMPORT_ERP_EMPLOYEES',
    resourceType: 'ERP',
    metadata: {
      requested: employees.length,
      imported: imported.length,
      skipped: skipped.length
    }
  });

  return res.status(200).json({
    success: true,
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
    defaultPasswordNote: 'Imported users are created with ERP_IMPORTED_DEFAULT_PASSWORD.'
  });
};
