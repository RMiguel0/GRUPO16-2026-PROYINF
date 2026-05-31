import crypto from 'node:crypto';
import { pool } from '../pool.js';
import { normalizeRut } from '../../utils/rut.js';

export async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      full_name varchar(255) NOT NULL,
      email varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      rut varchar(30) NOT NULL,
      phone varchar(50),
      role varchar(30) NOT NULL DEFAULT 'customer',
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rut varchar(30)');
  await pool.query(`
    UPDATE users
    SET rut = regexp_replace(
      upper(regexp_replace(rut, '[.\\s-]', '', 'g')),
      '^([0-9]{7,8})([0-9K])$',
      '\\1-\\2'
    )
    WHERE rut IS NOT NULL
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE rut IS NULL OR trim(rut) = '') THEN
        RAISE EXCEPTION 'Existen usuarios sin RUT. Completa users.rut antes de aplicar NOT NULL.';
      END IF;
    END $$;
  `);
  await pool.query('ALTER TABLE users ALTER COLUMN rut SET NOT NULL');
  await pool.query(`
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
  const normalizedRut = normalizeRut(rut);

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO users (id, full_name, email, password_hash, rut, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, full_name, email, rut, phone, role, created_at
      `,
      [id, fullName, normalizedEmail, passwordHash, normalizedRut, phone, role],
    );

    return rows[0];
  } catch (err) {
    if (err.code === '23505' && String(err.constraint || '').includes('rut')) {
      const error = new Error('Ya existe una cuenta asociada a ese RUT.');
      error.status = 409;
      throw error;
    }

    if (err.code === '23505') {
      const error = new Error('Ya existe una cuenta con ese correo.');
      error.status = 409;
      throw error;
    }

    throw err;
  }
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

export async function findUserByRut(rut) {
  await ensureAuthTables();
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE rut = $1',
    [normalizeRut(rut)],
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
