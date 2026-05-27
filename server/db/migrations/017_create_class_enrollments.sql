CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_code TEXT NULL,
  class_title TEXT NULL,
  class_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_by UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, course_code)
);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_learning_path_course
  ON class_enrollments (learning_path_id, course_code);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id
  ON class_enrollments (class_id);
