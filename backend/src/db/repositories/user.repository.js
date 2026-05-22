import crypto from 'node:crypto';
import { pool } from '../pool.js';

export async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      full_name varchar(255) NOT NULL,
      email varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      rut varchar(30),
      phone varchar(50),
      role varchar(30) NOT NULL DEFAULT 'customer',
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)');
}

export async function createUser({ fullName, email, passwordHash, rut = null, phone = null, role = 'customer' }) {
  await ensureAuthTables();
  const id = crypto.randomUUID();
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await pool.query(
    `
      INSERT INTO users (id, full_name, email, password_hash, rut, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, full_name, email, rut, phone, role, created_at
    `,
    [id, fullName, normalizedEmail, passwordHash, rut, phone, role],
  );

  return rows[0];
}

export async function findUserByEmail(email) {
  await ensureAuthTables();
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.trim().toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  await ensureAuthTables();
  const { rows } = await pool.query(
    'SELECT id, full_name, email, rut, phone, role, created_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function createSession({ userId, tokenHash, expiresAt }) {
  await ensureAuthTables();
  const id = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, userId, tokenHash, expiresAt],
  );
}

export async function findSessionByTokenHash(tokenHash) {
  await ensureAuthTables();
  const { rows } = await pool.query(
    `
      SELECT
        s.id,
        s.expires_at,
        u.id AS user_id,
        u.full_name,
        u.email,
        u.rut,
        u.phone,
        u.role,
        u.created_at AS user_created_at
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
}

export async function deleteSessionByTokenHash(tokenHash) {
  await ensureAuthTables();
  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteExpiredSessions() {
  await ensureAuthTables();
  await pool.query('DELETE FROM auth_sessions WHERE expires_at < NOW()');
}
