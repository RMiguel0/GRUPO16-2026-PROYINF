import { getUserFromToken } from '../services/auth.service.js';

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

export async function attachUser(req, _res, next) {
  try {
    req.user = await getUserFromToken(getBearerToken(req));
    return next();
  } catch (err) {
    return next(err);
  }
}

export default function auth(_roles = []) {
  return async (req, res, next) => {
    try {
      const user = await getUserFromToken(getBearerToken(req));
      if (!user) {
        return res.status(401).json({ error: 'Debes iniciar sesion.' });
      }

      req.user = user;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
