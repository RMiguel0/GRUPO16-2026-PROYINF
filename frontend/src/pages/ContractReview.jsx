// pages/ContractReview.jsx
import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import CanvasFirma from "../components/canvas_firma.jsx";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

export default function ContractReview() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const { token } = useAuth();
  const contract = state?.contract || null;
  const evaluation = state?.evaluation || null;
  const credit = state?.credit || null;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false); // ← nuevo
  const confirmingRef = useRef(false);

  const fromStorage = useMemo(() => {
    try {
      const raw = localStorage.getItem("latestContract");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const record = contract || fromStorage?.contract || null;
  const evalResult = evaluation || fromStorage?.evaluation || null;
  const creditRecord = credit || fromStorage?.credit || null;

  const money = (n) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(
      Math.round(Number(n) || 0)
    );

  const onConfirm = async () => {
    if (confirmingRef.current) return;
    if (!creditRecord?.id) {
      setError("No se encontro el credito asociado al contrato.");
      return;
    }
    confirmingRef.current = true;
    setConfirming(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/loans/${creditRecord.id}/confirm`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "No se pudo confirmar el credito.");
      try {
        localStorage.removeItem("latestContract");
        localStorage.removeItem("loanApplicationDraft");
        sessionStorage.removeItem("pendingLoanSimulation");
      } catch {}
      navigate("/perfil/mis-creditos", {
        replace: true,
        state: { creditConfirmed: true, credit: payload.credit },
      });
    } catch (err) {
      setError(err.message || "No se pudo confirmar el credito.");
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  const onBack = () => navigate(-1);

  if (!record || !evalResult) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Revision del Contrato</h1>
        <p>No se encontraron datos de contrato. Por favor inicia una solicitud primero.</p>
        <button onClick={() => navigate("/")} className="mt-4 px-4 py-2 border rounded-lg">
          Ir al inicio
        </button>
      </div>
    );
  }

  const applicantName = record.full_name ?? record.fullName ?? "-";
  const identification = record.identification ?? "-";
  const email = record.email ?? "-";
  const phone = record.phone ?? "-";
  const requestedAmount = record.requested_amount ?? record.amount ?? 0;
  const requestedTermMonths = record.requested_term_months ?? record.termMonths ?? "";
  const createdAtRaw = record.created_at ?? record.createdAt ?? null;
  const createdAtLabel = createdAtRaw ? new Date(createdAtRaw).toLocaleString() : "-";
  const rateMonthlyPct = evalResult.interestRateMonthly
    ? (evalResult.interestRateMonthly * 100).toFixed(2) : "-";
  const rateAnnualPct = evalResult.interestRateAnnual
    ? (evalResult.interestRateAnnual * 100).toFixed(2) : "-";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Resumen y Contrato</h1>

      {/* ── Datos del solicitante ── */}
      <section className="border rounded-xl p-4 space-y-1">
        <h2 className="font-semibold text-base mb-3">Datos del solicitante</h2>
        <Row label="Nombre" value={applicantName} />
        <Row label="RUT / Identificación" value={identification} />
        <Row label="Email" value={email} />
        <Row label="Teléfono" value={phone} />
        <Row label="Fecha de solicitud" value={createdAtLabel} />
      </section>

      {/* ── Condiciones del crédito ── */}
      <section className="border rounded-xl p-4 space-y-1">
        <h2 className="font-semibold text-base mb-3">Condiciones del crédito</h2>
        <Row label="Monto solicitado" value={money(requestedAmount)} />
        <Row label="Plazo" value={`${requestedTermMonths} meses`} />
        <Row label="Cuota mensual" value={money(evalResult.monthlyPayment)} />
        <Row label="Tasa mensual" value={`${rateMonthlyPct}%`} />
        <Row label="Tasa anual" value={`${rateAnnualPct}%`} />
        <Row label="Total a pagar" value={money(evalResult.totalPayment ?? 0)} />
        <Row label="Total intereses" value={money((evalResult.totalPayment ?? 0) - requestedAmount)} />
      </section>

      {/* ── Cláusulas ── */}
      <section className="border rounded-xl p-4">
        <h2 className="font-semibold text-base mb-3">Cláusulas del contrato</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          El solicitante declara haber leído y aceptado los términos y condiciones del presente
          contrato de crédito de consumo. El crédito será desembolsado según los plazos establecidos
          por la institución financiera. El no pago de las cuotas en las fechas acordadas podrá
          generar intereses moratorios y acciones de cobranza según la normativa vigente. El
          solicitante autoriza el uso de sus datos personales para fines exclusivamente relacionados
          con la gestión del presente crédito.
        </p>
      </section>

      {/* ── Checkbox de aceptación ── */}
      <div className="flex items-start gap-3 p-4 border rounded-xl bg-gray-50">
        <input
          id="terminos"
          type="checkbox"
          checked={aceptaTerminos}
          onChange={(e) => setAceptaTerminos(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-black"
        />
        <label htmlFor="terminos" className="text-sm text-gray-700 cursor-pointer">
          He leído y acepto los términos y condiciones del contrato de crédito detallados anteriormente.
        </label>
      </div>

      {/* ── Canvas de firma (solo visible si aceptó términos) ── */}
      {aceptaTerminos && (
        <section className="border rounded-xl p-4">
          <h2 className="font-medium mb-3">Firma del solicitante</h2>
          <CanvasFirma
            creditId={creditRecord?.id}
            email={record.email}
            datosContrato={{
              fullName: applicantName,
              identification,
              email,
              amount: requestedAmount,
              termMonths: requestedTermMonths,
              monthlyPayment: evalResult?.monthlyPayment,
              interestRateAnnual: evalResult?.interestRateAnnual,
              totalPayment: evalResult?.totalPayment,
              createdAt: createdAtRaw,
            }}
          />
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={confirming}
          className="px-4 py-2 rounded-lg border disabled:opacity-60">
          Volver
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming || !creditRecord?.id}
          className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: confirming || !creditRecord?.id ? "#666666" : "#000000" }}
        >
          {confirming ? "Confirmando..." : "Confirmar"}
        </button>
      </div>

      {!creditRecord?.id && (
        <p className="text-sm text-red-600">
          No se encontro el credito asociado. Vuelve a iniciar la solicitud para poder confirmar.
        </p>
      )}
    </div>
  );
}

// Componente auxiliar para filas de datos
function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}