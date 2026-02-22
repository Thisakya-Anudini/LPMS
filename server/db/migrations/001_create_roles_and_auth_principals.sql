DO $$ BEGIN
  CREATE TYPE role_type AS ENUM (
    'SUPER_ADMIN',
    'LEARNING_ADMIN',
    'SUPERVISOR',
    'EMPLOYEE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE principal_type AS ENUM ('USER', 'EMPLOYEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS auth_principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role role_type NOT NULL,
  name TEXT NOT NULL,
  principal_type principal_type NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
