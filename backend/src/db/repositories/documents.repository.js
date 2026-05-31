import { pool } from '../pool.js';
import { ensureAuthTables } from './user.repository.js';
import { normalizeRut } from '../../utils/rut.js';
import { stringifyJsonForPostgres } from '../../utils/postgresJson.js';

export const DOCUMENT_COLUMNS = {
  identity: 'identity',
  afp_imponibles: 'afp_imponibles',
  salary: 'salary',
  cmf_debt: 'cmf_debt',
  seniority: 'seniority',
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
      rut varchar(30) PRIMARY KEY REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

      identity jsonb NOT NULL DEFAULT '{}'::jsonb,
      afp_imponibles jsonb NOT NULL DEFAULT '{}'::jsonb,
      salary jsonb NOT NULL DEFAULT '{}'::jsonb,
      cmf_debt jsonb NOT NULL DEFAULT '{}'::jsonb,
      seniority jsonb NOT NULL DEFAULT '{}'::jsonb,
      financial_profile jsonb NOT NULL DEFAULT '{}'::jsonb,

      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_identity_gin ON documents USING gin (identity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_afp_gin ON documents USING gin (afp_imponibles)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_salary_gin ON documents USING gin (salary)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_cmf_gin ON documents USING gin (cmf_debt)');
}

export async function ensureDocumentRowForRut(rut) {
  await ensureDocumentsTable();
  const normalizedRut = normalizeRut(rut);

  await pool.query(
    `
      INSERT INTO documents (rut)
      VALUES ($1)
      ON CONFLICT (rut) DO NOTHING
    `,
    [normalizedRut],
  );
}

export async function findDocumentsByRut(rut) {
  await ensureDocumentRowForRut(rut);
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE rut = $1',
    [normalizeRut(rut)],
  );

  return rows[0] ?? null;
}

export async function updateDocumentSlot({ rut, documentType, payload }) {
  await ensureDocumentRowForRut(rut);
  const column = getDocumentColumn(documentType);

  const { rows } = await pool.query(
    `
      UPDATE documents
      SET ${column} = $2::jsonb,
          updated_at = NOW()
      WHERE rut = $1
      RETURNING *
    `,
    [normalizeRut(rut), stringifyJsonForPostgres(payload)],
  );

  return rows[0] ?? null;
}

export async function updateDocumentFields({ rut, documentType, fields }) {
  await ensureDocumentRowForRut(rut);
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
      WHERE rut = $1
      RETURNING *
    `,
    [normalizeRut(rut), stringifyJsonForPostgres(fields)],
  );

  return rows[0] ?? null;
}
