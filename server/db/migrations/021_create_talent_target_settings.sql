-- Migration 021: Create talent_target_settings table for time-versioned corporate targets
CREATE TABLE IF NOT EXISTS talent_target_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL UNIQUE,
  target_hours NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (target_hours > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth_principals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default 18.0h baseline for 2024, 2025, and 2026
INSERT INTO talent_target_settings (fiscal_year, target_hours, effective_from)
VALUES 
  (2024, 18.00, '2024-01-01'),
  (2025, 18.00, '2025-01-01'),
  (2026, 18.00, '2026-01-01')
ON CONFLICT (fiscal_year) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_talent_target_settings_year ON talent_target_settings(fiscal_year);