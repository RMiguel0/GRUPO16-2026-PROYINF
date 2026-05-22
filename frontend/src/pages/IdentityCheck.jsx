// pages/IdentityCheck.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EmailVerification from "../components/EmailVerification.jsx";
import FaceMatchCheck from "../components/FaceMatchCheck.jsx";
import { validarRUT } from "../utils/rutUtils.js";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Esta vista concentra:
 *  1) Validación de RUT (automática)
 *  2) Verificación de correo (OTP con SendGrid)
 *  3) Coincidencia facial (foto documento vs cámara)
 *
 * Llega desde LoanApplicationForm con:
 *  - state.application (datos de solicitud)
 *  - state.idImageFile (File de la foto del documento)
 */
export default function IdentityCheck() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const { token } = useAuth();

  // Normalizamos la entrada y damos un fallback de almacenamiento local
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

  // ⚠️ Para la comparación facial necesitamos sí o sí el archivo del documento
  const idImageFile = fromStateIdFile;

  // Estados de verificación
  const [rutOk, setRutOk] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [faceOk, setFaceOk] = useState(false);

  // Para “Reintentar” la coincidencia facial remonta el componente
  const [faceRunId, setFaceRunId] = useState(0);

  // Estado para manejar envío al backend y errores
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Valida RUT al montar
  useEffect(() => {
    const id = application?.applicant?.identification;
    setRutOk(Boolean(id) && validarRUT(id));
  }, [application]);

  // Guarda el application (para recuperación si recargan)
  useEffect(() => {
    if (fromStateApp) {
      try {
        localStorage.setItem("loanApplicationDraft", JSON.stringify(fromStateApp));
      } catch {}
    }
  }, [fromStateApp]);

  if (!application || !idImageFile) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Validación de identidad</h1>
        <div className="p-4 border rounded-lg">
          <h2 className="font-medium mb-2">Faltan datos</h2>
          <p className="text-sm text-gray-600">
            Vuelve al formulario y sube la imagen del documento para poder comparar el rostro.
          </p>
          <div className="mt-4">
            <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const email = application?.applicant?.email || "";

  const allOk = rutOk && emailVerified && faceOk;

  const handleContinue = async () => {
    if (!allOk) return;
    setServerError('');
    setSubmitting(true);
    try {
      // Extraemos datos necesarios para scoring
      const ident = application?.applicant?.identification;
      const fullName = application?.applicant?.fullName;
      const email = application?.applicant?.email;
      const phone = application?.applicant?.phone;
      const monthlyIncome = application?.applicant?.monthlyIncome;
      const employmentStatus = application?.applicant?.employmentStatus;
      const amount = application?.loan?.amount;
      const termMonths = application?.loan?.termMonths;

      const res = await fetch('/api/loans/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      if (!res.ok) {
        throw new Error('network');
      }
      const data = await res.json();
      if (data.rejected) {
        setServerError('Tu solicitud fue rechazada por alto riesgo. No podemos ofrecer este crédito.');
        setSubmitting(false);
        return;
      }
      // data.application contiene el registro guardado
      const contract = data.application;
      const evaluation = {
        score: data.score,
        risk: data.risk,
        interestRateMonthly: data.interestRateMonthly,
        interestRateAnnual: data.interestRateAnnual,
        monthlyPayment: data.monthlyPayment,
      };
      // Guardamos en localStorage para recuperación
      try {
        localStorage.setItem('latestContract', JSON.stringify({ contract, evaluation }));
      } catch {}
      navigate('/contract-review', {
        state: { contract, evaluation },
        replace: true,
      });
    } catch (err) {
      console.error('Error al aplicar solicitud:', err);
      setServerError('Ocurrió un error al evaluar tu solicitud. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm">
        ← Volver al formulario
      </button>

      <h1 className="text-2xl font-semibold mb-1">Validación de identidad</h1>
      <p className="text-gray-600 text-sm mb-6">
        Comprobemos que la persona del documento coincide contigo y que puedes recibir un código por correo.
      </p>

      {/* Datos del solicitante, como en ContractReview */}

      {/* Verificación de correo (migrada desde ContractReview) */}
      <section className="mb-6 border rounded-xl p-4">
        <h2 className="font-medium mb-3">Verificación de correo</h2>
        {email ? (
          <EmailVerification
            email={email}
            onVerified={() => setEmailVerified(true)}
          />
        ) : (
          <p className="text-sm text-red-600">No hay email para verificar.</p>
        )}
      </section>

      {/* Coincidencia facial (documento vs cámara) */}
      <section className="mb-6 border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Verificación de coincidencia facial</h2>
          <button
            type="button"
            onClick={() => {
              setFaceOk(false);
              setFaceRunId((n) => n + 1); // remonta el componente para reintentar
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
      </section>

      {/* CTA */}
      {serverError && (
        <div className="mb-4 text-sm text-red-600">{serverError}</div>
      )}
      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border">
          Volver
        </button>
        <button
          onClick={handleContinue}
          disabled={!allOk || submitting}
          className="px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: allOk && !submitting ? '#000000' : '#cccccc' }}
        >
          {submitting ? 'Evaluando...' : 'Continuar al contrato'}
        </button>
      </div>
    </div>
  );
}
