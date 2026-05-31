import crypto from 'node:crypto';
import { pool } from '../pool.js';
import { ensureAuthTables } from './user.repository.js';
import { normalizeRut } from '../../utils/rut.js';
import { stringifyJsonForPostgres } from '../../utils/postgresJson.js';

export const CREDIT_STATUS = {
  PROCESSING: 0,
  ACTIVE: 1,
  REJECTED: 2,
};

function normalizeCreditStatus(status) {
  const parsed = Number(status);
  if (![0, 1, 2].includes(parsed)) {
    const error = new Error('Estado de credito no soportado.');
    error.status = 400;
    throw error;
  }

  return parsed;
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

export async function ensureCreditsTable() {
  await ensureAuthTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credits (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      rut varchar(30) NOT NULL REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

      status smallint NOT NULL DEFAULT 0,
      product varchar(100) NOT NULL DEFAULT 'Credito de Consumo',

      amount numeric NOT NULL,
      term_months integer NOT NULL,
      interest_rate_monthly numeric,
      interest_rate_annual numeric,
      monthly_payment numeric,
      total_payment numeric,
      total_interest numeric,

      score integer,
      risk varchar(30),
      rejection_reason text,

      source_application_id uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW(),
      confirmed_at timestamp,
      rejected_at timestamp,

      CONSTRAINT credits_status_check CHECK (status IN (0, 1, 2))
    )
  `);

  await pool.query(`
    ALTER TABLE credits
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS rut varchar(30),
      ADD COLUMN IF NOT EXISTS status smallint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS product varchar(100) NOT NULL DEFAULT 'Credito de Consumo',
      ADD COLUMN IF NOT EXISTS amount numeric,
      ADD COLUMN IF NOT EXISTS term_months integer,
      ADD COLUMN IF NOT EXISTS interest_rate_monthly numeric,
      ADD COLUMN IF NOT EXISTS interest_rate_annual numeric,
      ADD COLUMN IF NOT EXISTS monthly_payment numeric,
      ADD COLUMN IF NOT EXISTS total_payment numeric,
      ADD COLUMN IF NOT EXISTS total_interest numeric,
      ADD COLUMN IF NOT EXISTS score integer,
      ADD COLUMN IF NOT EXISTS risk varchar(30),
      ADD COLUMN IF NOT EXISTS rejection_reason text,
      ADD COLUMN IF NOT EXISTS source_application_id uuid,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS confirmed_at timestamp,
      ADD COLUMN IF NOT EXISTS rejected_at timestamp
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'credits'::regclass
          AND conname = 'credits_status_check'
      ) THEN
        ALTER TABLE credits
          ADD CONSTRAINT credits_status_check CHECK (status IN (0, 1, 2));
      END IF;
    END $$;
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_credits_rut ON credits(rut)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at DESC)');
}

export async function createCredit(payload) {
  await ensureCreditsTable();

  const id = crypto.randomUUID();
  const status = normalizeCreditStatus(payload.status ?? CREDIT_STATUS.PROCESSING);
  const amount = Number(payload.amount);
  const termMonths = Number(payload.termMonths);

  if (!payload.userId || !payload.rut) {
    const error = new Error('userId y rut son obligatorios para crear un credito.');
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(termMonths) || termMonths <= 0) {
    const error = new Error('amount y termMonths deben ser valores positivos.');
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO credits (
        id,
        user_id,
        rut,
        status,
        product,
        amount,
        term_months,
        interest_rate_monthly,
        interest_rate_annual,
        monthly_payment,
        total_payment,
        total_interest,
        score,
        risk,
        rejection_reason,
        source_application_id,
        metadata,
        confirmed_at,
        rejected_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19
      )
      RETURNING *
    `,
    [
      id,
      payload.userId,
      normalizeRut(payload.rut),
      status,
      payload.product || 'Credito de Consumo',
      amount,
      termMonths,
      payload.interestRateMonthly ?? null,
      payload.interestRateAnnual ?? null,
      payload.monthlyPayment ?? null,
      payload.totalPayment ?? null,
      payload.totalInterest ?? null,
      payload.score ?? null,
      payload.risk ?? null,
      payload.rejectionReason ?? null,
      payload.sourceApplicationId ?? null,
      stringifyJsonForPostgres(normalizeMetadata(payload.metadata)),
      payload.confirmedAt ?? null,
      payload.rejectedAt ?? null,
    ],
  );

  return rows[0];
}

export async function findCreditsByUserId(userId) {
  await ensureCreditsTable();
  const { rows } = await pool.query(
    `
      SELECT *
      FROM credits
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  );

  return rows;
}

export async function findCreditByIdForUser({ creditId, userId }) {
  await ensureCreditsTable();
  const { rows } = await pool.query(
    `
      SELECT *
      FROM credits
      WHERE id = $1
        AND user_id = $2
    `,
    [creditId, userId],
  );

  return rows[0] ?? null;
}

export async function updateCreditStatus({ creditId, userId, status, patch = {} }) {
  await ensureCreditsTable();
  const nextStatus = normalizeCreditStatus(status);
  const { rows } = await pool.query(
    `
      UPDATE credits
      SET status = $3,
          risk = COALESCE($4, risk),
          rejection_reason = COALESCE($5, rejection_reason),
          confirmed_at = COALESCE($6, confirmed_at),
          rejected_at = COALESCE($7, rejected_at),
          metadata = metadata || $8::jsonb,
          updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING *
    `,
    [
      creditId,
      userId,
      nextStatus,
      patch.risk ?? null,
      patch.rejectionReason ?? null,
      patch.confirmedAt ?? null,
      patch.rejectedAt ?? null,
      stringifyJsonForPostgres(normalizeMetadata(patch.metadata)),
    ],
  );

  return rows[0] ?? null;
}
