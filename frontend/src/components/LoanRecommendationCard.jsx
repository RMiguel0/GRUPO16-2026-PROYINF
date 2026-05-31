import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

function money(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function formatDate(value) {
  if (!value) return "Sin fecha disponible";
  return new Date(value).toLocaleString("es-CL");
}

export default function LoanRecommendationCard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  async function fetchRecommendation() {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`${API_BASE}/api/profile/loan-recommendation`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload);
        return;
      }

      setData(payload);
    } catch (requestError) {
      console.error("Error obteniendo recomendacion:", requestError);
      setError({ error: "REQUEST_FAILED" });
    } finally {
      setLoading(false);
    }
  }

  function applyRecommendation(recommendation) {
    navigate("/apply", {
      state: {
        amount: recommendation.amount,
        termMonths: recommendation.termMonths,
        source: "loan-recommendation",
      },
    });
  }

  const missingDocuments = Array.isArray(error?.missingDocuments) ? error.missingDocuments : [];
  const missingData = error?.reason === "INSUFFICIENT_DOCUMENTS" || error?.error === "INSUFFICIENT_FINANCIAL_DATA";
  const recommendation = data?.recommendation;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-700">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-xl font-bold text-gray-800">Monto y plazo recomendado</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Recomendación auxiliar basada en tus documentos financieros procesados.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRecommendation}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Calculando..." : "Obtener recomendación"}
        </button>
      </div>

      {missingData && (
        <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              No podemos generar tu recomendación personalizada porque aún faltan documentos necesarios para evaluar tu perfil financiero.
            </p>
            {missingDocuments.length > 0 ? (
              <div className="mt-3 text-amber-800">
                <p className="font-medium">Documentos faltantes:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {missingDocuments.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-amber-800">
                Debes actualizar tus documentos financieros antes de solicitar una recomendación personalizada.
              </p>
            )}
          </div>
        </div>
      )}

      {error && !missingData && (
        <div className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>No se pudo generar la recomendación en este momento.</p>
        </div>
      )}

      {data && !recommendation && (
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          No encontramos escenarios que pasen los filtros de deuda y modelo con los datos actuales.
        </div>
      )}

      {recommendation && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
            <div className="mb-4 flex items-center gap-2 text-blue-800">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="font-semibold">Recomendación principal</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Metric label="Monto" value={money(recommendation.amount)} />
              <Metric label="Plazo" value={`${recommendation.termMonths} meses`} />
              <Metric label="Cuota estimada" value={money(recommendation.monthlyPayment)} />
              <Metric label="Probabilidad estimada" value={percent(recommendation.approvalProbability)} />
              <Metric label="Cuota / ingreso" value={percent(recommendation.paymentToIncome)} />
              <Metric label="Carga total" value={percent(recommendation.totalBurden)} />
            </div>

            <button
              type="button"
              onClick={() => applyRecommendation(recommendation)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              Aplicar esta recomendación
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800">Fuente utilizada</h3>
            <p className="mt-2 text-sm text-gray-600">
              Última extracción: {formatDate(data.sourceInfo?.extractedAt)}
            </p>
            <div className="mt-3 space-y-2">
              {(data.sourceInfo?.documentsUsed || []).map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">{document.documentType}</span>
                  <span className="text-gray-500">{formatDate(document.extractedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data?.alternatives?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-semibold text-gray-800">Alternativas recomendadas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-3">Monto</th>
                  <th className="py-3">Plazo</th>
                  <th className="py-3">Cuota</th>
                  <th className="py-3">Prob.</th>
                  <th className="py-3">Carga total</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.alternatives.map((alternative) => (
                  <tr key={`${alternative.amount}-${alternative.termMonths}`} className="border-b last:border-b-0">
                    <td className="py-3 font-medium">{money(alternative.amount)}</td>
                    <td className="py-3">{alternative.termMonths} meses</td>
                    <td className="py-3">{money(alternative.monthlyPayment)}</td>
                    <td className="py-3">{percent(alternative.approvalProbability)}</td>
                    <td className="py-3">{percent(alternative.totalBurden)}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => applyRecommendation(alternative)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Aplicar
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-blue-700">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
