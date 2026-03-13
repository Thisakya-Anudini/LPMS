ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signer_name TEXT;

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signer_title TEXT;

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signature_file TEXT;

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signature_file_type VARCHAR(50);
