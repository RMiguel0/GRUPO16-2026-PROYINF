// Repositorio: agrupa consultas SQL de 'loan'.
import { pool } from '../pool.js';
import crypto from 'node:crypto';
import { ensureAuthTables } from './user.repository.js';

/**
 * Ensure the loan_application table exists with the required schema.
 * This helper will create the table if it doesn't exist.
 */
async function ensureTable() {
  await ensureAuthTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_application (
      id uuid PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      identification varchar(30) NOT NULL,
      full_name varchar(255) NOT NULL,
      email varchar(255),
      phone varchar(50),
      monthly_income numeric NOT NULL,
      employment_status varchar(50),
      requested_amount numeric NOT NULL,
      requested_term_months integer NOT NULL,
      score integer,
      risk varchar(10),
      interest_rate_monthly numeric,
      interest_rate_annual numeric,
      monthly_payment numeric,
      rejected boolean DEFAULT false,
      signed boolean DEFAULT false,
      created_at timestamp DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE loan_application ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_loan_application_user_id ON loan_application(user_id)');
}

/**
 * Persist a loan application and its evaluation result.
 * Returns the inserted row.
 *
 * @param {object} payload Data to insert: identification, full_name, email, phone,
 * monthly_income, employment_status, requested_amount, requested_term_months,
 * score, risk, interest_rate_monthly, interest_rate_annual, monthly_payment, rejected
 */
export async function createLoanApplication(payload) {
  await ensureTable();
  const id = crypto.randomUUID();
  const {
    user_id,
    identification,
    full_name,
    email,
    phone,
    monthly_income,
    employment_status,
    requested_amount,
    requested_term_months,
    score,
    risk,
    interest_rate_monthly,
    interest_rate_annual,
    monthly_payment,
    rejected,
  } = payload;
  const { rows } = await pool.query(
    `
      INSERT INTO loan_application (
        id,
        user_id,
        identification,
        full_name,
        email,
        phone,
        monthly_income,
        employment_status,
        requested_amount,
        requested_term_months,
        score,
        risk,
        interest_rate_monthly,
        interest_rate_annual,
        monthly_payment,
        rejected,
        signed
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false)
      RETURNING *
    `,
    [
      id,
      user_id ?? null,
      identification,
      full_name,
      email,
      phone,
      monthly_income,
      employment_status,
      requested_amount,
      requested_term_months,
      score,
      risk,
      interest_rate_monthly,
      interest_rate_annual,
      monthly_payment,
      rejected,
    ],
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await pool.query('select * from loan_application where id = $1', [id]);
  return rows[0] ?? null;
}
