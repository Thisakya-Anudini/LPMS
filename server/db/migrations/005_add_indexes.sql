CREATE INDEX IF NOT EXISTS idx_auth_principals_email ON auth_principals(email);
CREATE INDEX IF NOT EXISTS idx_auth_principals_role ON auth_principals(role);
CREATE INDEX IF NOT EXISTS idx_auth_principals_active ON auth_principals(is_active);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_principal_id ON refresh_tokens(principal_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_learning_paths_status ON learning_paths(status);
CREATE INDEX IF NOT EXISTS idx_learning_paths_created_by ON learning_paths(created_by);

CREATE INDEX IF NOT EXISTS idx_enrollments_principal_id ON enrollments(principal_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_learning_path_id ON enrollments(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

CREATE INDEX IF NOT EXISTS idx_notifications_principal_id ON notifications(principal_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
