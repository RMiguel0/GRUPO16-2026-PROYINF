import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

import authRoutes from './routes/auth.routes.js';
import ocrRoutes from './routes/ocr.routes.js';
import profileRoutes from './routes/profile.routes.js';
import routes from './routes/index.js';
import { bootstrapAuth } from './services/auth.service.js';
import { generateOtp, saveOtp, verifyAndConsumeOtp } from './utils/otp.js';
import { sendOtpEmail } from './utils/email.js';
import errorHandler from './middlewares/error.js';

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://host.docker.internal:5173',
    ],
    credentials: true,
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', ocrRoutes);
app.use('/api', routes);

app.post('/api/applications', (req, res) => {
  const {
    identification,
    fullName,
    email,
    phone,
    monthlyIncome,
    employmentStatus,
    amount,
    termMonths,
    interestRate,
    dataConsent,
  } = req.body || {};

  const income = Math.max(1, Number(monthlyIncome || 0));
  const amt = Number(amount || 0);
  const dti = (amt / income) * 100;
  const score = Math.round(650 + Math.max(-100, 50 - dti));
  const decision = score >= 620 && dataConsent ? 'pre-approved' : 'referred';
  const applicationId = crypto.randomUUID();

  return res.status(201).json({
    applicationId,
    decision,
    score,
    dti: Number(dti.toFixed(2)),
    contractData: {
      applicationId,
      fullName,
      identification,
      email,
      phone,
      monthlyIncome,
      employmentStatus,
      amount,
      termMonths,
      interestRate,
    },
  });
});

app.post('/api/otp/send', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'invalid_email' });
    }

    const code = generateOtp(6);
    saveOtp(email, code, 10);

    const sent = await sendOtpEmail({ to: email, code });
    if (!sent?.ok) {
      return res.status(500).json({ success: false, error: 'send_failed' });
    }

    const reveal =
      process.env.SEND_OTP_IN_RESPONSE === 'true' ||
      process.env.NODE_ENV !== 'production';

    return res.json({ success: true, ...(reveal ? { code } : {}) });
  } catch (err) {
    console.error('[/api/otp/send] error:', err);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

app.post('/api/otp/verify', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || typeof email !== 'string' || !code) {
    return res.status(400).json({ success: false, error: 'missing_params' });
  }

  const result = verifyAndConsumeOtp(email, String(code));
  if (!result.ok) {
    const http = { not_found: 404, expired: 410, mismatch: 401 };
    return res
      .status(http[result.reason] || 400)
      .json({ success: false, error: result.reason });
  }

  return res.json({ success: true });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function start() {
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bootstrapAuth();
      app.listen(PORT, () => console.log(`API listening on :${PORT}`));
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error('No se pudo inicializar la autenticacion:', err);
        process.exit(1);
      }

      console.log(`Esperando base de datos para auth (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

start();
