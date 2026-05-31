// pages/ContractReview.jsx
import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(Math.round(Number(n) || 0));

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
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || payload.error || "No se pudo confirmar el credito.");
      }

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

  const applicantName =
    record.full_name ??
    record.fullName ??
    "-";

  const identification =
    record.identification ?? "-";

  const email =
    record.email ?? "-";

  const phone =
    record.phone ?? "-";

  const requestedAmount =
    record.requested_amount ??
    record.amount ??
    0;

  const requestedTermMonths =
    record.requested_term_months ??
    record.termMonths ??
    "";

  const createdAtRaw =
    record.created_at ??
    record.createdAt ??
    null;

  const createdAtLabel = createdAtRaw
    ? new Date(createdAtRaw).toLocaleString()
    : "-";

  const rateMonthlyPct = evalResult.interestRateMonthly
    ? (evalResult.interestRateMonthly * 100).toFixed(2)
    : "-";
  const rateAnnualPct = evalResult.interestRateAnnual
    ? (evalResult.interestRateAnnual * 100).toFixed(2)
    : "-";

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Resumen y Contrato</h1>

      <section className="mb-6 border rounded-xl p-4">
        <h2 className="font-medium mb-3">Datos del solicitante</h2>
        <ul className="text-sm leading-7">
          <li><strong>Nombre:</strong> {applicantName}</li>
          <li><strong>RUT:</strong> {identification}</li>
          <li><strong>Email:</strong> {email}</li>
          <li><strong>Telefono:</strong> {phone}</li>
        </ul>
      </section>

      <section className="mb-6 border rounded-xl p-4">
        <h2 className="font-medium mb-3">Detalles del credito</h2>
        <ul className="text-sm leading-7">
          <li><strong>Monto solicitado:</strong> {money(requestedAmount)}</li>
          <li>
            <strong>Plazo:</strong>{" "}
            {requestedTermMonths ? `${requestedTermMonths} meses` : "-"}
          </li>
          <li><strong>Cuota mensual estimada:</strong> {money(evalResult.monthlyPayment)}</li>
          <li><strong>Tasa mensual:</strong> {rateMonthlyPct}%</li>
          <li><strong>Tasa anual equivalente:</strong> {rateAnnualPct}%</li>
          <li><strong>Riesgo:</strong> {evalResult.risk}</li>
          <li><strong>Score interno:</strong> {evalResult.score}</li>
        </ul>
      </section>

      <section className="mb-6 border rounded-xl p-4">
        <h2 className="font-medium mb-3">Clausulas principales</h2>
        <ol className="list-decimal ml-5 text-sm space-y-2">
          <li>El solicitante declara que los datos ingresados son veraces.</li>
          <li>Las condiciones indicadas de tasa, cuota y plazo son las que aplican al momento de este contrato.</li>
          <li>Al confirmar, el credito quedara vigente y visible en Mis Creditos.</li>
        </ol>
      </section>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={confirming} className="px-4 py-2 rounded-lg border disabled:opacity-60">
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

      {!creditRecord?.id ? (
        <p className="mt-3 text-sm text-red-600">
          No se encontro el credito asociado. Vuelve a iniciar la solicitud para poder confirmar.
        </p>
      ) : null}

      <p className="text-xs text-gray-500 mt-6">
        Solicitud creada: {createdAtLabel}
      </p>
    </div>
  );
}
