import { Router } from 'express';
import { getUserFromToken, loginUser, logoutToken, registerUser } from '../services/auth.service.js';

const router = Router();

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

function handleAuthError(err, res) {
  return res.status(err.status || 500).json({
    error: err.message || 'Error de autenticacion.',
  });
}

router.post('/register', async (req, res) => {
  try {
    const result = await registerUser(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body || {});
    return res.json(result);
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.get('/me', async (req, res) => {
  const user = await getUserFromToken(getBearerToken(req));
  if (!user) {
    return res.status(401).json({ error: 'Sesion invalida o expirada.' });
  }

  return res.json({ user });
});

router.post('/logout', async (req, res) => {
  await logoutToken(getBearerToken(req));
  return res.json({ ok: true });
});

export default router;
