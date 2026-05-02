import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;
const APP_NAME = process.env.APP_NAME || "App";

if (!GMAIL_USER) {
  console.error("[Gmail] Falta GMAIL_USER en el entorno");
}

if (!GMAIL_APP_PASSWORD) {
  console.error("[Gmail] Falta GMAIL_APP_PASSWORD en el entorno");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

export async function sendOtpEmail({ to, code }) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return {
      ok: false,
      error: "Faltan credenciales de Gmail en el entorno",
    };
  }

  const msg = {
    to,
    from: `${APP_NAME} <${MAIL_FROM}>`,
    subject: `[${APP_NAME}] Tu código de verificación`,
    text: `Tu código es ${code}. Expira en 10 minutos.`,
    html: `
      <div style="font-family:sans-serif">
        <h2>${APP_NAME}</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:2px">${code}</p>
        <p>Expira en 10 minutos.</p>
      </div>`,
  };

  try {
    await transporter.sendMail(msg);
    console.log(`[Gmail] Correo enviado a ${to}`);
    return { ok: true };
  } catch (err) {
    console.error("[Gmail] Error:", err);

    return {
      ok: false,
      error: err?.response || err?.message || "Error enviando correo con Gmail",
    };
  }
}