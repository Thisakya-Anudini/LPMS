-- Ensure one progress row per enrollment + stage so course completion can be upserted safely.

DELETE FROM enrollment_progress ep
WHERE ep.id IN (
  SELECT stale.id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY enrollment_id, stage_id ORDER BY created_at DESC, id DESC) AS rn
    FROM enrollment_progress
    WHERE stage_id IS NOT NULL
  ) AS stale
  WHERE stale.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_progress_enrollment_stage_unique
  ON enrollment_progress (enrollment_id, stage_id)
  WHERE stage_id IS NOT NULL;
