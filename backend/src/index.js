// backend/src/index.js
import express from "express";
import cors from "cors";
import crypto from "node:crypto";

import { generateOtp, saveOtp, verifyAndConsumeOtp } from "./utils/otp.js";
import { sendOtpEmail } from "./utils/email.js";
import "dotenv/config";

const app = express();
app.use(express.json());

// CORS (Vite en host local o dentro de Docker)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://host.docker.internal:5173",
    ],
    credentials: true,
  }),
);

// --- Solicitud de préstamo (stub) ---
app.post("/api/applications", (req, res) => {
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
  const decision = score >= 620 && dataConsent ? "pre-approved" : "referred";

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

app.post("/api/loans/apply", (req, res) => {
  const {
    identification,
    fullName,
    email,
    phone,
    monthlyIncome,
    employmentStatus,
    amount,
    termMonths,
  } = req.body || {};

  // Validación mínima de campos obligatorios
  if (
    !identification ||
    !fullName ||
    !email ||
    amount == null ||
    termMonths == null
  ) {
    return res.status(400).json({
      error: "missing_required_fields",
    });
  }

  // Usa tu función de scoring con los parámetros correctos
  const amt = Number(amount);
  const term = Number(termMonths);
  const income = Number(monthlyIncome);

  const evalResult = evaluateApplication(amt, term, income, employmentStatus);
  // evalResult: { score, risk, interestRateMonthly, interestRateAnnual, monthlyPayment, rejected }

  // Construimos un "contrato" / aplicación persistible
  const applicationId = crypto.randomUUID();
  const application = {
    id: applicationId,
    identification,
    fullName,
    email,
    phone,
    monthlyIncome,
    employmentStatus,
    amount,
    termMonths,
    status: evalResult.rejected ? "REJECTED" : "APPROVED",
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json({
    application,
    ...evalResult, // score, risk, interestRateMonthly, interestRateAnnual, monthlyPayment, rejected
  });
});

// --- OTP: enviar (via SendGrid) ---
app.post("/api/otp/send", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "invalid_email" });
    }

    const code = generateOtp(6);
    // guarda por 10 minutos (TTL en milisegundos)
    saveOtp(email, code, 10 * 60 * 1000);

    // envía por correo con SendGrid
    const sent = await sendOtpEmail({ to: email, code });
    if (!sent?.ok) {
      return res.status(500).json({ success: false, error: "send_failed" });
    }

    // Para desarrollo puedes ver el código en la respuesta.
    const reveal =
      process.env.SEND_OTP_IN_RESPONSE === "true" ||
      process.env.NODE_ENV !== "production";

    return res.json({ success: true, ...(reveal ? { code } : {}) });
  } catch (err) {
    console.error("[/api/otp/send] error:", err);
    return res.status(500).json({ success: false, error: "internal_error" });
  }
});

// --- OTP: verificar ---
app.post("/api/otp/verify", (req, res) => {
  const { email, code } = req.body || {};
  if (!email || typeof email !== "string" || !code) {
    return res.status(400).json({ success: false, error: "missing_params" });
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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

import "dotenv/config";
import ocrRoutes from "./routes/ocr.routes.js";
app.use("/api", ocrRoutes);

// --- Loan simulation ---
// Endpoint to evaluate a loan application based solely on form inputs.
// It computes a credit score and assigns an interest rate according to
// predefined thresholds. If the applicant is deemed high risk the loan
// will be rejected and no rate will be returned.
import { evaluateApplication } from "./utils/scoring.js";
import routes from "./routes/index.js";

// Mount modular routes for loans and other services under /api.
app.use("/api", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stub API listening on :${PORT}`));
