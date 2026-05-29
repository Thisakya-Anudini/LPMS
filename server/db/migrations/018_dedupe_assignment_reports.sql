WITH ranked_reports AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY learning_path_id, assignment_source
      ORDER BY created_at ASC, id ASC
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY learning_path_id, assignment_source
      ORDER BY assigned_at DESC, created_at DESC, id DESC
    ) AS newest_rank,
    BOOL_OR(report_status = 'ENROLLED_IN_ERP') OVER (
      PARTITION BY learning_path_id, assignment_source
    ) AS has_erp_status
  FROM assignment_reports
  WHERE learning_path_id IS NOT NULL
),
latest_reports AS (
  SELECT *
  FROM ranked_reports
  WHERE newest_rank = 1
)
UPDATE assignment_reports keepers
SET learning_path_title = latest.learning_path_title,
    assigned_by_principal_id = latest.assigned_by_principal_id,
    assigned_by_name = latest.assigned_by_name,
    assigned_by_role = latest.assigned_by_role,
    report_status = CASE
      WHEN latest_rank.has_erp_status THEN 'ENROLLED_IN_ERP'
      ELSE latest.report_status
    END,
    assigned_at = latest.assigned_at,
    updated_at = NOW()
FROM latest_reports latest_rank
JOIN assignment_reports latest ON latest.id = latest_rank.id
WHERE keepers.id = latest_rank.keeper_id;

WITH ranked_reports AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY learning_path_id, assignment_source
      ORDER BY created_at ASC, id ASC
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY learning_path_id, assignment_source
      ORDER BY created_at ASC, id ASC
    ) AS report_rank
  FROM assignment_reports
  WHERE learning_path_id IS NOT NULL
)
INSERT INTO assignment_report_learners (
  report_id,
  principal_id,
  employee_number,
  learner_name,
  learner_email,
  designation,
  grade_name
)
SELECT DISTINCT ON (ranked.keeper_id, learners.employee_number)
  ranked.keeper_id,
  learners.principal_id,
  learners.employee_number,
  learners.learner_name,
  learners.learner_email,
  learners.designation,
  learners.grade_name
FROM ranked_reports ranked
JOIN assignment_report_learners learners ON learners.report_id = ranked.id
WHERE ranked.report_rank > 1
  AND NOT EXISTS (
    SELECT 1
    FROM assignment_report_learners existing_learners
    WHERE existing_learners.report_id = ranked.keeper_id
      AND existing_learners.employee_number = learners.employee_number
  )
ORDER BY ranked.keeper_id, learners.employee_number, learners.created_at ASC, learners.id ASC;

WITH ranked_reports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY learning_path_id, assignment_source
      ORDER BY created_at ASC, id ASC
    ) AS report_rank
  FROM assignment_reports
  WHERE learning_path_id IS NOT NULL
)
DELETE FROM assignment_reports reports
USING ranked_reports ranked
WHERE reports.id = ranked.id
  AND ranked.report_rank > 1;

WITH ranked_learners AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY report_id, employee_number
      ORDER BY created_at ASC, id ASC
    ) AS learner_rank
  FROM assignment_report_learners
)
DELETE FROM assignment_report_learners learners
USING ranked_learners ranked
WHERE learners.id = ranked.id
  AND ranked.learner_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_reports_learning_path_source_unique
  ON assignment_reports (learning_path_id, assignment_source)
  WHERE learning_path_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_report_learners_report_employee_unique
  ON assignment_report_learners (report_id, employee_number);
