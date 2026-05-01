import { query } from '../db.js';

export const ASSIGNMENT_REPORT_STATUS = {
  ASSIGNED_IN_LPMS: 'ASSIGNED_IN_LPMS',
  ENROLLED_IN_ERP: 'ENROLLED_IN_ERP'
};

export const ASSIGNMENT_REPORT_SOURCE = {
  LEARNING_ADMIN: 'LEARNING_ADMIN',
  SUPERVISOR: 'SUPERVISOR'
};

export const createAssignmentReport = async ({
  learningPathId,
  learningPathTitle,
  assignedByPrincipalId,
  assignedByName,
  assignedByRole,
  assignmentSource,
  learners
}) => {
  if (!Array.isArray(learners) || learners.length === 0) {
    return null;
  }

  const reportResult = await query(
    `
      INSERT INTO assignment_reports (
        learning_path_id,
        learning_path_title,
        assigned_by_principal_id,
        assigned_by_name,
        assigned_by_role,
        assignment_source,
        report_status,
        assigned_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `,
    [
      learningPathId || null,
      learningPathTitle,
      assignedByPrincipalId || null,
      assignedByName,
      assignedByRole,
      assignmentSource,
      ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS
    ]
  );

  const reportId = reportResult.rows[0]?.id;
  if (!reportId) {
    return null;
  }

  for (const learner of learners) {
    await query(
      `
        INSERT INTO assignment_report_learners (
          report_id,
          principal_id,
          employee_number,
          learner_name,
          learner_email,
          designation,
          grade_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        reportId,
        learner.principalId || null,
        learner.employeeNumber,
        learner.learnerName,
        learner.learnerEmail || null,
        learner.designation || null,
        learner.gradeName || null
      ]
    );
  }

  return reportId;
};
