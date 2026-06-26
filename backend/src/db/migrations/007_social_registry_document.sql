ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS social_registry jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_documents_social_registry_gin
  ON documents USING gin (social_registry);
