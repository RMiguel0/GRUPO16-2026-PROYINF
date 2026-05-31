UPDATE users
SET rut = regexp_replace(
  upper(regexp_replace(rut, '[.\s-]', '', 'g')),
  '^([0-9]{7,8})([0-9K])$',
  '\1-\2'
)
WHERE rut IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE rut IS NULL OR trim(rut) = '') THEN
    RAISE EXCEPTION 'Existen usuarios sin RUT. Completa users.rut antes de aplicar NOT NULL.';
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN rut SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_rut_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_rut_unique UNIQUE (rut);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  rut varchar(30) PRIMARY KEY REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

  identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
  salary jsonb NOT NULL DEFAULT '{}'::jsonb,
  cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
  seniority jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

INSERT INTO documents (rut)
SELECT rut
FROM users
ON CONFLICT (rut) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_identity_gin
  ON documents USING gin (identity);

CREATE INDEX IF NOT EXISTS idx_documents_afp_gin
  ON documents USING gin (afp_imponibles);

CREATE INDEX IF NOT EXISTS idx_documents_salary_gin
  ON documents USING gin (salary);

CREATE INDEX IF NOT EXISTS idx_documents_cmf_gin
  ON documents USING gin (cmf_debt);
