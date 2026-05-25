CREATE TABLE IF NOT EXISTS processed_documents (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  document_type varchar(80) NOT NULL,
  raw_text text,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source varchar(80),
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_documents_user_created
  ON processed_documents(user_id, created_at DESC);
