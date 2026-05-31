import crypto from 'node:crypto';
import { pool } from '../pool.js';
import { ensureAuthTables } from './user.repository.js';
import {
  sanitizePostgresText,
  stringifyJsonForPostgres,
} from '../../utils/postgresJson.js';

export async function ensureProcessedDocumentsTable() {
  await ensureAuthTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS processed_documents (
      id uuid PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      document_type varchar(80) NOT NULL,
      raw_text text,
      extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      source varchar(80),
      created_at timestamp NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_processed_documents_user_created ON processed_documents(user_id, created_at DESC)');
}

export async function saveProcessedDocument({
  userId,
  documentType,
  rawText = null,
  extractedData = {},
  source = null,
}) {
  await ensureProcessedDocumentsTable();
  const id = crypto.randomUUID();

  const { rows } = await pool.query(
    `
      INSERT INTO processed_documents (
        id,
        user_id,
        document_type,
        raw_text,
        extracted_data,
        source
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      RETURNING *
    `,
    [
      id,
      userId ?? null,
      documentType,
      sanitizePostgresText(rawText),
      stringifyJsonForPostgres(extractedData),
      source,
    ],
  );

  return rows[0];
}

export async function findLatestProcessedDocumentsForUser(userId, limit = 20) {
  await ensureProcessedDocumentsTable();
  const { rows } = await pool.query(
    `
      SELECT id, user_id, document_type, extracted_data, source, created_at
      FROM processed_documents
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit],
  );

  return rows;
}
