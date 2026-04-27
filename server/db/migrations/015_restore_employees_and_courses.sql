CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE course_type AS ENUM ('ONLINE', 'CLASSROOM', 'HYBRID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID NOT NULL UNIQUE REFERENCES auth_principals(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  grade_name TEXT NOT NULL,
  supervisor_id UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration TEXT NOT NULL,
  type course_type NOT NULL DEFAULT 'ONLINE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stage_courses
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE enrollment_progress
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

UPDATE stage_courses
SET course_order = 1
WHERE course_order IS NULL;

ALTER TABLE stage_courses
  ALTER COLUMN course_order SET DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_courses_stage_course_order_unique
  ON stage_courses (stage_id, course_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_courses_stage_course_unique
  ON stage_courses (stage_id, course_id)
  WHERE course_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_progress_enrollment_course_unique
  ON enrollment_progress (enrollment_id, course_id)
  WHERE course_id IS NOT NULL;

WITH snapshot_courses AS (
  SELECT DISTINCT
    COALESCE(NULLIF(TRIM(sc.course_code), ''), 'SNAP_' || md5(COALESCE(TRIM(sc.course_title), '') || '|' || COALESCE(TRIM(sc.course_duration), '') || '|' || COALESCE(TRIM(sc.delivery_mode), ''))) AS normalized_code,
    COALESCE(NULLIF(TRIM(sc.course_title), ''), 'Imported course') AS normalized_title,
    COALESCE(NULLIF(TRIM(sc.course_duration), ''), '-') AS normalized_duration,
    CASE UPPER(COALESCE(TRIM(sc.delivery_mode), 'ONLINE'))
      WHEN 'CLASSROOM' THEN 'CLASSROOM'::course_type
      WHEN 'PHYSICAL' THEN 'CLASSROOM'::course_type
      WHEN 'HYBRID' THEN 'HYBRID'::course_type
      ELSE 'ONLINE'::course_type
    END AS normalized_type
  FROM stage_courses sc
  WHERE (sc.course_code IS NOT NULL AND TRIM(sc.course_code) <> '')
     OR (sc.course_title IS NOT NULL AND TRIM(sc.course_title) <> '')
)
INSERT INTO courses (code, title, description, duration, type)
SELECT
  normalized_code,
  normalized_title,
  normalized_title || ' (restored from snapshot)',
  normalized_duration,
  normalized_type
FROM snapshot_courses
ON CONFLICT (code) DO NOTHING;

UPDATE stage_courses sc
SET course_id = c.id
FROM courses c
WHERE sc.course_id IS NULL
  AND c.code = COALESCE(
    NULLIF(TRIM(sc.course_code), ''),
    'SNAP_' || md5(COALESCE(TRIM(sc.course_title), '') || '|' || COALESCE(TRIM(sc.course_duration), '') || '|' || COALESCE(TRIM(sc.delivery_mode), ''))
  );

UPDATE enrollment_progress ep
SET course_id = c.id
FROM courses c
WHERE ep.course_id IS NULL
  AND c.code = NULLIF(TRIM(ep.course_code), '');

WITH employee_sources AS (
  SELECT DISTINCT
    en.principal_id,
    NULLIF(TRIM(en.employee_number), '') AS employee_number,
    NULLIF(TRIM(en.learner_designation), '') AS designation,
    NULLIF(TRIM(en.learner_grade_name), '') AS grade_name
  FROM enrollments en
  WHERE en.principal_id IS NOT NULL
    AND en.employee_number IS NOT NULL
    AND TRIM(en.employee_number) <> ''

  UNION

  SELECT DISTINCT
    cert.principal_id,
    NULLIF(TRIM(cert.employee_number), '') AS employee_number,
    NULL AS designation,
    NULL AS grade_name
  FROM certificates cert
  WHERE cert.principal_id IS NOT NULL
    AND cert.employee_number IS NOT NULL
    AND TRIM(cert.employee_number) <> ''

  UNION

  SELECT DISTINCT
    n.principal_id,
    NULLIF(TRIM(n.employee_number), '') AS employee_number,
    NULL AS designation,
    NULL AS grade_name
  FROM notifications n
  WHERE n.principal_id IS NOT NULL
    AND n.employee_number IS NOT NULL
    AND TRIM(n.employee_number) <> ''
),
preferred_employees AS (
  SELECT DISTINCT ON (principal_id)
    principal_id,
    employee_number,
    COALESCE(designation, 'Learner') AS designation,
    COALESCE(grade_name, 'N/A') AS grade_name
  FROM employee_sources
  WHERE principal_id IS NOT NULL
    AND employee_number IS NOT NULL
  ORDER BY principal_id, employee_number
)
INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
SELECT principal_id, employee_number, designation, grade_name, NULL
FROM preferred_employees
WHERE employee_number IS NOT NULL
ON CONFLICT (employee_number) DO NOTHING;

WITH preferred_principal_ids AS (
  SELECT DISTINCT principal_id
  FROM employees
  WHERE principal_id IS NOT NULL
)
INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
SELECT
  ap.id,
  CASE
    WHEN position('@' in ap.email) > 1 THEN split_part(ap.email, '@', 1)
    ELSE ap.email
  END AS employee_number,
  'Learner' AS designation,
  'N/A' AS grade_name,
  NULL
FROM auth_principals ap
WHERE ap.principal_type = 'EMPLOYEE'
  AND ap.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM preferred_principal_ids ppi
    WHERE ppi.principal_id = ap.id
  )
  AND ap.email IS NOT NULL
  AND TRIM(ap.email) <> ''
ON CONFLICT (employee_number) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'learning_admin_assignments'
      AND constraint_name = 'learning_admin_assignments_employee_number_fkey'
  ) THEN
    ALTER TABLE learning_admin_assignments
      ADD CONSTRAINT learning_admin_assignments_employee_number_fkey
      FOREIGN KEY (employee_number) REFERENCES employees(employee_number) ON DELETE CASCADE;
  END IF;
END $$;
