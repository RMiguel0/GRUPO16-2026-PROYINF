import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EmailVerification from "../components/EmailVerification.jsx";
import FaceMatchCheck from "../components/FaceMatchCheck.jsx";
import { validarRUT } from "../utils/rutUtils.js";
import { useAuth } from "../context/AuthContext.jsx";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

export default function IdentityCheck() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const { token } = useAuth();

  const fromStateApp = state?.application || null;
  const fromStateIdFile = state?.idImageFile || null;

  const fromStorage = useMemo(() => {
    try {
      const raw = localStorage.getItem("loanApplicationDraft");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const application = useMemo(
    () => fromStateApp || fromStorage || null,
    [fromStateApp, fromStorage]
  );

  const idImageFile = fromStateIdFile;
  const requiresFaceMatch = Boolean(idImageFile);

  const [rutOk, setRutOk] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [faceOk, setFaceOk] = useState(false);
  const [faceRunId, setFaceRunId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const id = application?.applicant?.identification;
    setRutOk(Boolean(id) && validarRUT(id));
  }, [application]);

  useEffect(() => {
    if (fromStateApp) {
      try {
        localStorage.setItem("loanApplicationDraft", JSON.stringify(fromStateApp));
      } catch {}
    }
  }, [fromStateApp]);

  if (!application) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Validacion de identidad</h1>
        <div className="p-4 border rounded-lg">
          <h2 className="font-medium mb-2">Faltan datos</h2>
          <p className="text-sm text-gray-600">
            Vuelve a la solicitud para revisar los datos del credito y documentos.
          </p>
          <div className="mt-4">
            <button onClick={() => navigate("/apply")} className="px-4 py-2 rounded-lg border">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const email = application?.applicant?.email || "";
  const allOk = rutOk && emailVerified && (!requiresFaceMatch || faceOk);

  const handleContinue = async () => {
    if (!allOk) return;
    setServerError("");
    setSubmitting(true);
    try {
      const ident = application?.applicant?.identification;
      const fullName = application?.applicant?.fullName;
      const email = application?.applicant?.email;
      const phone = application?.applicant?.phone;
      const monthlyIncome = application?.applicant?.monthlyIncome;
      const employmentStatus = application?.applicant?.employmentStatus;
      const amount = application?.loan?.amount;
      const termMonths = application?.loan?.termMonths;

      const res = await fetch(`${API_BASE}/api/loans/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          identification: ident,
          fullName,
          email,
          phone,
          monthlyIncome,
          employmentStatus,
          amount,
          termMonths,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "network");
      }

      if (data.rejected) {
        setServerError("Tu solicitud fue rechazada por alto riesgo. No podemos ofrecer este credito.");
        setSubmitting(false);
        return;
      }

      const contract = data.application;
      const evaluation = {
        score: data.score,
        risk: data.risk,
        interestRateMonthly: data.interestRateMonthly,
        interestRateAnnual: data.interestRateAnnual,
        monthlyPayment: data.monthlyPayment,
      };

      try {
        localStorage.setItem("latestContract", JSON.stringify({ contract, evaluation }));
      } catch {}

      navigate("/contract-review", {
        state: { contract, evaluation },
        replace: true,
      });
    } catch (err) {
      console.error("Error al aplicar solicitud:", err);
      setServerError(err.message || "Ocurrio un error al evaluar tu solicitud. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm">
        Volver a la solicitud
      </button>

      <h1 className="text-2xl font-semibold mb-1">Validacion de identidad</h1>
      <p className="text-gray-600 text-sm mb-6">
        Comprobemos que el RUT de la solicitud es valido y que puedes recibir un codigo por correo.
      </p>

      <section className="mb-6 border rounded-xl p-4">
        <h2 className="font-medium mb-3">Verificacion de correo</h2>
        {email ? (
          <EmailVerification
            email={email}
            onVerified={() => setEmailVerified(true)}
          />
        ) : (
          <p className="text-sm text-red-600">No hay email para verificar.</p>
        )}
      </section>

      <section className="mb-6 border rounded-xl p-4">
        {requiresFaceMatch ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Verificacion de coincidencia facial</h2>
              <button
                type="button"
                onClick={() => {
                  setFaceOk(false);
                  setFaceRunId((n) => n + 1);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Reintentar
              </button>
            </div>

            <FaceMatchCheck
              key={faceRunId}
              idImageFile={idImageFile}
              onPassed={() => setFaceOk(true)}
              onFailed={() => setFaceOk(false)}
            />
          </>
        ) : (
          <div>
            <h2 className="font-medium mb-2">Validacion documental</h2>
            <p className="text-sm text-gray-600">
              La solicitud usa los documentos cargados en tu perfil. En este flujo la identidad continua con RUT y verificacion por correo.
            </p>
          </div>
        )}
      </section>

      {serverError ? (
        <div className="mb-4 text-sm text-red-600">{serverError}</div>
      ) : null}

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border">
          Volver
        </button>
        <button
          onClick={handleContinue}
          disabled={!allOk || submitting}
          className="px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: allOk && !submitting ? "#000000" : "#cccccc" }}
        >
          {submitting ? "Evaluando..." : "Continuar al contrato"}
        </button>
      </div>
    </div>
  );
}
