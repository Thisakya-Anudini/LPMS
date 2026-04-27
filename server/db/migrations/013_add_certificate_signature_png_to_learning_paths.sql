ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS certificate_signature_png TEXT;
