-- Keep only the newest 20 notifications per principal.
-- This runs after every insert and trims older rows automatically.

CREATE OR REPLACE FUNCTION trim_notifications_per_principal()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM notifications
  WHERE principal_id = NEW.principal_id
    AND id IN (
      SELECT id
      FROM notifications
      WHERE principal_id = NEW.principal_id
      ORDER BY created_at DESC, id DESC
      OFFSET 20
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trim_notifications_per_principal ON notifications;

CREATE TRIGGER trg_trim_notifications_per_principal
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION trim_notifications_per_principal();

-- One-time cleanup for existing rows before this trigger existed.
DELETE FROM notifications n
WHERE n.id IN (
  SELECT stale.id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY principal_id ORDER BY created_at DESC, id DESC) AS rn
    FROM notifications
  ) AS stale
  WHERE stale.rn > 20
);

CREATE INDEX IF NOT EXISTS idx_notifications_principal_created_id
  ON notifications (principal_id, created_at DESC, id DESC);
