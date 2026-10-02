-- Migration 020: Create Talent Development Dashboard tables

-- 1. Organizational Hierarchy Closure Table
CREATE TABLE IF NOT EXISTS org_hierarchy_closure (
  ancestor_principal_id UUID NOT NULL REFERENCES auth_principals(id) ON DELETE CASCADE,
  descendant_principal_id UUID NOT NULL REFERENCES auth_principals(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ancestor_principal_id, descendant_principal_id)
);

CREATE INDEX IF NOT EXISTS idx_org_closure_descendant 
  ON org_hierarchy_closure(descendant_principal_id);
CREATE INDEX IF NOT EXISTS idx_org_closure_depth 
  ON org_hierarchy_closure(depth);

-- 2. Training Records Table
CREATE TABLE IF NOT EXISTS training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID NOT NULL REFERENCES auth_principals(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL,
  program_name TEXT NOT NULL,
  training_type TEXT NOT NULL DEFAULT 'ONLINE',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (duration_hours >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_records_principal 
  ON training_records(principal_id);
CREATE INDEX IF NOT EXISTS idx_training_records_dates 
  ON training_records(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_records_type 
  ON training_records(training_type);
CREATE INDEX IF NOT EXISTS idx_training_records_emp_no 
  ON training_records(employee_number);

-- 3. Seed initial self-references (depth = 0) for existing auth principals
INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
SELECT id, id, 0
FROM auth_principals
ON CONFLICT (ancestor_principal_id, descendant_principal_id) DO NOTHING;

-- 4. Seed immediate direct reports (depth = 1) from existing employees table
INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
SELECT supervisor_id, principal_id, 1
FROM employees
WHERE supervisor_id IS NOT NULL
ON CONFLICT (ancestor_principal_id, descendant_principal_id) DO NOTHING;
