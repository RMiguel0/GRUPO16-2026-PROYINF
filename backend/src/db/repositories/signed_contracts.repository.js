// db/repositories/signed_contracts.repository.js
import crypto from 'node:crypto';
import { pool } from '../pool.js';
import { ensureCreditsTable } from './credits.repository.js';

export async function ensureSignedContractsTable() {
  await ensureCreditsTable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signed_contracts (
      id             uuid PRIMARY KEY,
      credit_id      uuid NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
      user_id        uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,

      -- Identidad del firmante
      signer_name    varchar(255) NOT NULL,
      signer_email   varchar(255) NOT NULL,
      signer_rut     varchar(30)  NOT NULL,

      -- Evidencia legal
      ip_address     varchar(45),
      user_agent     text,
      firma_hash     text NOT NULL,

      -- Estampa de tiempo
      signed_at      timestamp NOT NULL DEFAULT NOW(),

      -- Estado
      status         varchar(30) NOT NULL DEFAULT 'signed'
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_signed_contracts_credit_id ON signed_contracts(credit_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_signed_contracts_user_id   ON signed_contracts(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_signed_contracts_signed_at ON signed_contracts(signed_at DESC)');
}

export async function createSignedContract({
  creditId,
  userId,
  signerName,
  signerEmail,
  signerRut,
  ipAddress,
  userAgent,
  firmaBase64,
}) {
  await ensureSignedContractsTable();

  const id = crypto.randomUUID();

  // Hash SHA-256 de la firma para evidencia legal (no guardamos el base64 completo)
  const firmaHash = crypto
    .createHash('sha256')
    .update(firmaBase64)
    .digest('hex');

  const { rows } = await pool.query(
    `
      INSERT INTO signed_contracts (
        id, credit_id, user_id,
        signer_name, signer_email, signer_rut,
        ip_address, user_agent, firma_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      id, creditId, userId,
      signerName, signerEmail, signerRut,
      ipAddress ?? null,
      userAgent ?? null,
      firmaHash,
    ],
  );

  return rows[0];
}

export async function findSignedContractByCreditId(creditId) {
  await ensureSignedContractsTable();
  const { rows } = await pool.query(
    'SELECT * FROM signed_contracts WHERE credit_id = $1 ORDER BY signed_at DESC LIMIT 1',
    [creditId],
  );
  return rows[0] ?? null;
}