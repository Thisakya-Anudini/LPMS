CREATE TABLE IF NOT EXISTS assignment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NULL,
  learning_path_title TEXT NOT NULL,
  assigned_by_principal_id UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  assigned_by_name TEXT NOT NULL,
  assigned_by_role TEXT NOT NULL,
  assignment_source TEXT NOT NULL,
  report_status TEXT NOT NULL DEFAULT 'ASSIGNED_IN_LPMS',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assignment_reports_source
    CHECK (assignment_source IN ('LEARNING_ADMIN', 'SUPERVISOR')),
  CONSTRAINT chk_assignment_reports_status
    CHECK (report_status IN ('ASSIGNED_IN_LPMS', 'ENROLLED_IN_ERP'))
);

CREATE TABLE IF NOT EXISTS assignment_report_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES assignment_reports(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  employee_number TEXT NOT NULL,
  learner_name TEXT NOT NULL,
  learner_email TEXT NULL,
  designation TEXT NULL,
  grade_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_reports_assigned_at
  ON assignment_reports (assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_reports_status
  ON assignment_reports (report_status);

CREATE INDEX IF NOT EXISTS idx_assignment_report_learners_report_id
  ON assignment_report_learners (report_id);
