ALTER TABLE stage_courses
  ADD COLUMN IF NOT EXISTS course_order INT;

UPDATE stage_courses
SET course_order = 1
WHERE course_order IS NULL;

ALTER TABLE stage_courses
  ALTER COLUMN course_order SET DEFAULT 1;

ALTER TABLE stage_courses
  ALTER COLUMN course_order SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_courses_stage_course_order_unique
  ON stage_courses (stage_id, course_order);

ALTER TABLE enrollment_progress
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_progress_enrollment_course_unique
  ON enrollment_progress (enrollment_id, course_id)
  WHERE course_id IS NOT NULL;
