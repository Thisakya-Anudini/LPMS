ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS learner_name TEXT,
  ADD COLUMN IF NOT EXISTS learner_email TEXT,
  ADD COLUMN IF NOT EXISTS learner_designation TEXT,
  ADD COLUMN IF NOT EXISTS learner_grade_name TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS learner_name TEXT,
  ADD COLUMN IF NOT EXISTS learner_email TEXT;

ALTER TABLE stage_courses
  ADD COLUMN IF NOT EXISTS course_code TEXT,
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS course_duration TEXT,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT;

ALTER TABLE enrollment_progress
  ADD COLUMN IF NOT EXISTS course_code TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    UPDATE enrollments en
    SET employee_number = e.employee_number,
        learner_designation = COALESCE(en.learner_designation, e.designation),
        learner_grade_name = COALESCE(en.learner_grade_name, e.grade_name),
        learner_name = COALESCE(en.learner_name, ap.name),
        learner_email = COALESCE(en.learner_email, ap.email)
    FROM employees e
    LEFT JOIN auth_principals ap ON ap.id = e.principal_id
    WHERE en.principal_id = e.principal_id
      AND (en.employee_number IS NULL OR en.employee_number = '');

    UPDATE notifications n
    SET employee_number = e.employee_number
    FROM employees e
    WHERE n.principal_id = e.principal_id
      AND (n.employee_number IS NULL OR n.employee_number = '');

    UPDATE certificates c
    SET employee_number = e.employee_number,
        learner_name = COALESCE(c.learner_name, ap.name),
        learner_email = COALESCE(c.learner_email, ap.email)
    FROM employees e
    LEFT JOIN auth_principals ap ON ap.id = e.principal_id
    WHERE c.principal_id = e.principal_id
      AND (c.employee_number IS NULL OR c.employee_number = '');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'courses'
  ) THEN
    UPDATE stage_courses sc
    SET course_code = c.code,
        course_title = c.title,
        course_duration = c.duration,
        delivery_mode = c.type::text
    FROM courses c
    WHERE sc.course_id = c.id
      AND (sc.course_code IS NULL OR sc.course_code = '');

    UPDATE enrollment_progress ep
    SET course_code = c.code
    FROM courses c
    WHERE ep.course_id = c.id
      AND (ep.course_code IS NULL OR ep.course_code = '');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_employee_learning_path_unique
  ON enrollments (employee_number, learning_path_id)
  WHERE employee_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_employee_learning_path_scope_unique
  ON certificates (employee_number, learning_path_id, scope)
  WHERE employee_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_progress_enrollment_course_code_unique
  ON enrollment_progress (enrollment_id, course_code)
  WHERE course_code IS NOT NULL;

ALTER TABLE learning_admin_assignments
  DROP CONSTRAINT IF EXISTS learning_admin_assignments_employee_number_fkey;

ALTER TABLE stage_courses
  DROP CONSTRAINT IF EXISTS stage_courses_course_id_fkey;

ALTER TABLE enrollment_progress
  DROP CONSTRAINT IF EXISTS enrollment_progress_course_id_fkey;

ALTER TABLE stage_courses
  DROP COLUMN IF EXISTS course_id;

ALTER TABLE enrollment_progress
  DROP COLUMN IF EXISTS course_id;

DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS employees;
