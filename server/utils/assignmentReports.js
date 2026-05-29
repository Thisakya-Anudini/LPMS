import { getClient } from '../db.js';

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

  const client = await getClient();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [String(learningPathId || ''), assignmentSource]
    );

    const existingReport = learningPathId
      ? await client.query(
          `
            SELECT id
            FROM assignment_reports
            WHERE learning_path_id = $1
              AND assignment_source = $2
            FOR UPDATE
          `,
          [learningPathId, assignmentSource]
        )
      : { rows: [] };

    const reportResult = existingReport.rows[0]?.id
      ? await client.query(
          `
            UPDATE assignment_reports
            SET learning_path_title = $2,
                assigned_by_principal_id = $3,
                assigned_by_name = $4,
                assigned_by_role = $5,
                report_status = $6,
                assigned_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id
          `,
          [
            existingReport.rows[0].id,
            learningPathTitle,
            assignedByPrincipalId || null,
            assignedByName,
            assignedByRole,
            ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS
          ]
        )
      : await client.query(
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
      await client.query('ROLLBACK');
      return null;
    }

    for (const learner of learners) {
      await client.query(
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
          ON CONFLICT (report_id, employee_number) DO UPDATE SET
            principal_id = COALESCE(EXCLUDED.principal_id, assignment_report_learners.principal_id),
            learner_name = EXCLUDED.learner_name,
            learner_email = EXCLUDED.learner_email,
            designation = EXCLUDED.designation,
            grade_name = EXCLUDED.grade_name
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

    await client.query('COMMIT');
    return reportId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
