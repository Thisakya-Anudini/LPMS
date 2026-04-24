CREATE TABLE IF NOT EXISTS learning_admin_assignments (
  employee_number TEXT PRIMARY KEY REFERENCES employees(employee_number) ON DELETE CASCADE,
  assigned_by_principal_id UUID NOT NULL REFERENCES auth_principals(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_admin_assignments_assigned_by
  ON learning_admin_assignments (assigned_by_principal_id);
