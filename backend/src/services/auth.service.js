import crypto from 'node:crypto';
import {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  ensureAuthTables,
  findSessionByTokenHash,
  findUserByEmail,
  findUserByRut,
} from '../db/repositories/user.repository.js';
import { ensureDocumentRowForUser } from '../db/repositories/documents.repository.js';
import { isValidRut, normalizeRut } from '../utils/rut.js';

const HASH_ALGORITHM = 'sha256';
const HASH_ITERATIONS = 310000;
const HASH_KEY_LENGTH = 32;
const SESSION_DAYS = 7;

function normalizeUser(row) {
  return {
    id: row.user_id ?? row.id,
    name: row.full_name,
    email: row.email,
    rut: row.rut,
    phone: row.phone,
    role: row.role,
  };
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');

  return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, iterationsText, salt, expectedHash] = String(storedHash).split('$');
  if (scheme !== `pbkdf2_${HASH_ALGORITHM}` || !iterationsText || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationsText);
  const actualHash = crypto
    .pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createAuthSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await createSession({ userId: user.id, tokenHash, expiresAt });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function bootstrapAuth() {
  await ensureAuthTables();
  await deleteExpiredSessions();

  const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@banco.cl';
  const existingDemo = await findUserByEmail(demoEmail);
  if (existingDemo) {
    if (existingDemo.rut) {
      await ensureDocumentRowForUser({ userId: existingDemo.id, rut: existingDemo.rut });
    }
    return;
  }

  const demoRut = normalizeRut(process.env.DEMO_USER_RUT || '11111111-1');

  const demoUser = await createUser({
    fullName: process.env.DEMO_USER_NAME || 'Usuario Demo',
    email: demoEmail,
    passwordHash: hashPassword(process.env.DEMO_USER_PASSWORD || 'Demo1234'),
    rut: demoRut,
  });

  await ensureDocumentRowForUser({ userId: demoUser.id, rut: demoUser.rut });
}

export async function registerUser({ fullName, email, password, rut, phone }) {
  if (!fullName || !email || !password || !rut) {
    const error = new Error('Nombre, correo, contrasena y RUT son obligatorios.');
    error.status = 400;
    throw error;
  }

  const normalizedRut = normalizeRut(rut);
  if (!isValidRut(normalizedRut)) {
    const error = new Error('RUT invalido.');
    error.status = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error('La contrasena debe tener al menos 8 caracteres.');
    error.status = 400;
    throw error;
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const error = new Error('Ya existe una cuenta con ese correo.');
    error.status = 409;
    throw error;
  }

  const existingRut = await findUserByRut(normalizedRut);
  if (existingRut) {
    const error = new Error('Ya existe una cuenta asociada a ese RUT.');
    error.status = 409;
    throw error;
  }

  const user = await createUser({
    fullName,
    email,
    passwordHash: hashPassword(password),
    rut: normalizedRut,
    phone,
  });

  await ensureDocumentRowForUser({ userId: user.id, rut: user.rut });

  const session = await createAuthSession(user);
  return { user: normalizeUser(user), ...session };
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    const error = new Error('Debes ingresar correo y contrasena.');
    error.status = 400;
    throw error;
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    const error = new Error('Correo o contrasena incorrectos.');
    error.status = 401;
    throw error;
  }

  const session = await createAuthSession(user);
  return { user: normalizeUser(user), ...session };
}

export async function getUserFromToken(token) {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await findSessionByTokenHash(tokenHash);
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return normalizeUser(session);
}

export async function logoutToken(token) {
  if (!token) return;
  await deleteSessionByTokenHash(hashToken(token));
}
