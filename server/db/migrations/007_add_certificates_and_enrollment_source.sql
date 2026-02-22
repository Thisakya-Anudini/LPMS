DO $$ BEGIN
  CREATE TYPE certificate_scope AS ENUM ('STAGE', 'FULL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS enrollment_source TEXT NOT NULL DEFAULT 'MANUAL';

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID NOT NULL REFERENCES auth_principals(id) ON DELETE CASCADE,
  learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  scope certificate_scope NOT NULL DEFAULT 'FULL',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_by UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  UNIQUE (principal_id, learning_path_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_certificates_principal_id ON certificates(principal_id);
CREATE INDEX IF NOT EXISTS idx_certificates_learning_path_id ON certificates(learning_path_id);
