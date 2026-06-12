CREATE TABLE IF NOT EXISTS class_detail_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  class_id TEXT NOT NULL,
  course_category TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL DEFAULT '',
  offering_name TEXT NOT NULL DEFAULT '',
  catalog_year TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  class_title TEXT NOT NULL DEFAULT '',
  training_center TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  enrollment_start_date TEXT NOT NULL DEFAULT '',
  enrollment_end_date TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  per_head_cost TEXT NOT NULL DEFAULT '',
  bond TEXT NOT NULL DEFAULT '',
  bond_value TEXT NOT NULL DEFAULT '',
  bond_duration TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learning_path_id, course_code, class_id)
);

CREATE INDEX IF NOT EXISTS idx_class_detail_reports_lookup
  ON class_detail_reports (learning_path_id, course_code, class_id);
