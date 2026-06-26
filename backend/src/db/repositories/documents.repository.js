import { pool } from '../pool.js';
import { ensureAuthTables } from './user.repository.js';
import { normalizeRut } from '../../utils/rut.js';
import { stringifyJsonForPostgres } from '../../utils/postgresJson.js';

export const DOCUMENT_COLUMNS = {
  identity: 'identity',
  afp_imponibles: 'afp_imponibles',
  salary: 'salary',
  cmf_debt: 'cmf_debt',
  social_registry: 'social_registry',
  financial_profile: 'financial_profile',
};

function getDocumentColumn(documentType) {
  const column = DOCUMENT_COLUMNS[documentType];
  if (!column) {
    const error = new Error(`Tipo de documento no soportado: ${documentType}`);
    error.status = 400;
    throw error;
  }

  return column;
}

export async function ensureDocumentsTable() {
  await ensureAuthTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      rut varchar(30) NOT NULL REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

      identity jsonb NOT NULL DEFAULT '{}'::jsonb,
      afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
      salary jsonb NOT NULL DEFAULT '{}'::jsonb,
      cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
      social_registry jsonb NOT NULL DEFAULT '{}'::jsonb,
      financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,

      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS rut varchar(30),
      ADD COLUMN IF NOT EXISTS identity jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS salary jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS social_registry jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE documents d
    SET user_id = u.id
    FROM users u
    WHERE d.user_id IS NULL
      AND d.rut = u.rut
  `);

  await pool.query(`
    UPDATE documents d
    SET rut = u.rut
    FROM users u
    WHERE d.user_id = u.id
      AND (d.rut IS NULL OR trim(d.rut) = '')
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM documents WHERE user_id IS NULL) THEN
        RAISE EXCEPTION 'Existen documentos sin user_id. Revisa documents.rut contra users.rut.';
      END IF;

      IF EXISTS (SELECT 1 FROM documents WHERE rut IS NULL OR trim(rut) = '') THEN
        RAISE EXCEPTION 'Existen documentos sin rut auxiliar. Revisa documents.user_id contra users.id.';
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE documents
      ALTER COLUMN user_id SET NOT NULL,
      ALTER COLUMN rut SET NOT NULL
  `);

  await pool.query(`
    DO $$
    DECLARE
      pk_name text;
      pk_columns text[];
    BEGIN
      SELECT c.conname, array_agg(a.attname::text ORDER BY cols.ordinality)
      INTO pk_name, pk_columns
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = cols.attnum
      WHERE c.conrelid = 'documents'::regclass
        AND c.contype = 'p'
      GROUP BY c.conname;

      IF pk_name IS NOT NULL AND pk_columns <> ARRAY['user_id']::text[] THEN
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
  `);

  await pool.query(`
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
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_rut ON documents(rut)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_identity_gin ON documents USING gin (identity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_afp_gin ON documents USING gin (afp_imponibles)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_salary_gin ON documents USING gin (salary)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_cmf_gin ON documents USING gin (cmf_debt)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_social_registry_gin ON documents USING gin (social_registry)');
}

function requireUserId(userId) {
  if (!userId) {
    const error = new Error('userId es obligatorio para operar documentos.');
    error.status = 400;
    throw error;
  }
}

async function findUserIdentityByRut(rut) {
  await ensureDocumentsTable();
  const normalizedRut = normalizeRut(rut);
  const { rows } = await pool.query(
    'SELECT id, rut FROM users WHERE rut = $1',
    [normalizedRut],
  );

  return rows[0] ?? null;
}

export async function ensureDocumentRowForUser({ userId, rut }) {
  await ensureDocumentsTable();
  requireUserId(userId);
  const normalizedRut = normalizeRut(rut);

  const { rows } = await pool.query(
    `
      INSERT INTO documents (user_id, rut)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET rut = EXCLUDED.rut
      RETURNING *
    `,
    [userId, normalizedRut],
  );

  return rows[0] ?? null;
}

export async function ensureDocumentRowForRut(rut) {
  const user = await findUserIdentityByRut(rut);
  if (!user) {
    const error = new Error('No existe un usuario asociado al RUT indicado.');
    error.status = 404;
    throw error;
  }

  return ensureDocumentRowForUser({ userId: user.id, rut: user.rut });
}

export async function findDocumentsByUserId(userId, rut) {
  await ensureDocumentRowForUser({ userId, rut });
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE user_id = $1',
    [userId],
  );

  return rows[0] ?? null;
}

export async function findDocumentsByRut(rut) {
  const user = await findUserIdentityByRut(rut);
  if (!user) return null;

  return findDocumentsByUserId(user.id, user.rut);
}

export async function updateDocumentSlot({ userId, rut, documentType, payload }) {
  if (!userId) {
    const user = await findUserIdentityByRut(rut);
    if (!user) return null;

    return updateDocumentSlot({
      userId: user.id,
      rut: user.rut,
      documentType,
      payload,
    });
  }

  await ensureDocumentRowForUser({ userId, rut });
  const column = getDocumentColumn(documentType);

  const { rows } = await pool.query(
    `
      UPDATE documents
      SET ${column} = $2::jsonb,
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, stringifyJsonForPostgres(payload)],
  );

  return rows[0] ?? null;
}

export async function updateDocumentFields({ userId, rut, documentType, fields }) {
  if (!userId) {
    const user = await findUserIdentityByRut(rut);
    if (!user) return null;

    return updateDocumentFields({
      userId: user.id,
      rut: user.rut,
      documentType,
      fields,
    });
  }

  await ensureDocumentRowForUser({ userId, rut });
  const column = getDocumentColumn(documentType);

  const { rows } = await pool.query(
    `
      UPDATE documents
      SET ${column} = jsonb_set(
            COALESCE(${column}, '{}'::jsonb),
            '{fields}',
            COALESCE(${column}->'fields', '{}'::jsonb) || $2::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, stringifyJsonForPostgres(fields)],
  );

  return rows[0] ?? null;
}
