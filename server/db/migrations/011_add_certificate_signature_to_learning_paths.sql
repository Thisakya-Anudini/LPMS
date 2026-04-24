ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signer_name TEXT;

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signer_title TEXT;
