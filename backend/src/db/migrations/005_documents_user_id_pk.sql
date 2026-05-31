ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id IS NULL) THEN
    RAISE EXCEPTION 'Existen usuarios sin id. Completa users.id antes de migrar documents.user_id.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rut varchar(30);

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
DECLARE
  rut_attnum smallint;
BEGIN
  SELECT attnum INTO rut_attnum
  FROM pg_attribute
  WHERE attrelid = 'users'::regclass
    AND attname = 'rut'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[rut_attnum]
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_rut_unique UNIQUE (rut);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  rut varchar(30) NOT NULL REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

  identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
  salary jsonb NOT NULL DEFAULT '{}'::jsonb,
  cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
  seniority jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS rut varchar(30),
  ADD COLUMN IF NOT EXISTS identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS salary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seniority jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW();

UPDATE documents d
SET user_id = u.id
FROM users u
WHERE d.user_id IS NULL
  AND d.rut = u.rut;

UPDATE documents d
SET rut = u.rut
FROM users u
WHERE d.user_id = u.id
  AND (d.rut IS NULL OR trim(d.rut) = '');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM documents WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Existen documentos sin user_id. Revisa documentos cuyo rut no coincide con users.rut.';
  END IF;

  IF EXISTS (SELECT 1 FROM documents WHERE rut IS NULL OR trim(rut) = '') THEN
    RAISE EXCEPTION 'Existen documentos sin rut auxiliar. Revisa documents.user_id contra users.id.';
  END IF;
END $$;

ALTER TABLE documents
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN rut SET NOT NULL;

DO $$
DECLARE
  pk_name text;
  pk_columns text[];
BEGIN
  SELECT c.conname, array_agg(a.attname ORDER BY cols.ordinality)
  INTO pk_name, pk_columns
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = cols.attnum
  WHERE c.conrelid = 'documents'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF pk_name IS NOT NULL AND pk_columns <> ARRAY['user_id'] THEN
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT %I', pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = cols.attnum
    WHERE c.conrelid = 'documents'::regclass
      AND c.contype = 'p'
    GROUP BY c.conname
    HAVING array_agg(a.attname::text ORDER BY cols.ordinality) = ARRAY['user_id']::text[]
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$
DECLARE
  user_id_attnum smallint;
  rut_attnum smallint;
BEGIN
  SELECT attnum INTO user_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'documents'::regclass
    AND attname = 'user_id'
    AND NOT attisdropped;

  SELECT attnum INTO rut_attnum
  FROM pg_attribute
  WHERE attrelid = 'documents'::regclass
    AND attname = 'rut'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[user_id_attnum]
      AND confrelid = 'users'::regclass
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[rut_attnum]
      AND confrelid = 'users'::regclass
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_rut_fkey
      FOREIGN KEY (rut) REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_rut
  ON documents(rut);

CREATE INDEX IF NOT EXISTS idx_documents_identity_gin
  ON documents USING gin (identity);

CREATE INDEX IF NOT EXISTS idx_documents_afp_gin
  ON documents USING gin (afp_imponibles);

CREATE INDEX IF NOT EXISTS idx_documents_salary_gin
  ON documents USING gin (salary);

CREATE INDEX IF NOT EXISTS idx_documents_cmf_gin
  ON documents USING gin (cmf_debt);
