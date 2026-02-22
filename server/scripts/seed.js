import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { ROLES } from '../constants/roles.js';

const createPrincipal = async ({ email, role, name, password, principalType = 'USER' }) => {
  const existing = await query('SELECT id FROM auth_principals WHERE email = $1 LIMIT 1', [email]);
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `
      INSERT INTO auth_principals (email, password_hash, role, name, principal_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [email, passwordHash, role, name, principalType]
  );

  return result.rows[0].id;
};

const run = async () => {
  const superAdminId = await createPrincipal({
    email: 'admin@lpms.com',
    role: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    password: 'Admin@123'
  });

  const learningAdminId = await createPrincipal({
    email: 'ladmin@lpms.com',
    role: ROLES.LEARNING_ADMIN,
    name: 'Learning Admin',
    password: 'Admin@123'
  });

  const supervisorId = await createPrincipal({
    email: 'supervisor@lpms.com',
    role: ROLES.SUPERVISOR,
    name: 'Supervisor',
    password: 'Admin@123'
  });

  const employeePrincipalId = await createPrincipal({
    email: 'employee@lpms.com',
    role: ROLES.EMPLOYEE,
    name: 'Employee',
    password: 'Employee@123',
    principalType: 'EMPLOYEE'
  });

  await query(
    `
      INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
      VALUES ($1, 'EMP0001', 'Software Engineer', 'G5', $2)
      ON CONFLICT (employee_number) DO NOTHING
    `,
    [employeePrincipalId, supervisorId]
  );

  const pathResult = await query(
    `
      INSERT INTO learning_paths (title, description, category, total_duration, status, created_by)
      VALUES ('New Hire Onboarding', 'Core onboarding journey', 'RESTRICTED', '3h', 'ACTIVE', $1)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [learningAdminId]
  );

  let learningPathId;
  if (pathResult.rowCount > 0) {
    learningPathId = pathResult.rows[0].id;
  } else {
    const existingPath = await query(
      'SELECT id FROM learning_paths WHERE title = $1 LIMIT 1',
      ['New Hire Onboarding']
    );
    learningPathId = existingPath.rows[0].id;
  }

  await query(
    `
      INSERT INTO enrollments (principal_id, learning_path_id, status, progress, enrolled_at, approval_status)
      VALUES ($1, $2, 'IN_PROGRESS', 45, NOW(), 'APPROVED')
      ON CONFLICT (principal_id, learning_path_id) DO NOTHING
    `,
    [employeePrincipalId, learningPathId]
  );

  await query(
    `
      INSERT INTO notifications (principal_id, title, message, type, is_read)
      VALUES ($1, 'Course Assigned', 'You have been enrolled in New Hire Onboarding.', 'INFO', FALSE)
      ON CONFLICT DO NOTHING
    `,
    [employeePrincipalId]
  );

  await query(
    `
      INSERT INTO audit_logs (actor_principal_id, action, resource_type, resource_id, metadata)
      VALUES ($1, 'SEED_DATA_CREATED', 'SYSTEM', NULL, $2::jsonb)
    `,
    [superAdminId, JSON.stringify({ by: 'seed-script' })]
  );

  console.log('Seed completed.');
};

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
