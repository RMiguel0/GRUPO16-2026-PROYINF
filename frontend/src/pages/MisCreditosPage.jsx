import { useEffect, useMemo, useState } from "react";
import LoanRecommendationCard from "../components/LoanRecommendationCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyCredits } from "../utils/creditsApi.js";

const CREDIT_STATUS = {
  0: "Procesando",
  1: "Vigente",
  2: "Rechazado",
};

function money(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function percent(value) {
  if (value === null || value === undefined || value === "") return "Sin tasa";
  return `${((Number(value) || 0) * 100).toFixed(2)}%`;
}

function date(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL");
}

function byStatus(credits, status) {
  return credits.filter((credit) => Number(credit.status) === status);
}

function statusClass(status) {
  if (Number(status) === 1) return "bg-green-50 text-green-700 border-green-200";
  if (Number(status) === 2) return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function MisCreditosPage() {
  const { token } = useAuth();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeCredits = useMemo(() => byStatus(credits, 1), [credits]);
  const processingCredits = useMemo(() => byStatus(credits, 0), [credits]);
  const rejectedCredits = useMemo(() => byStatus(credits, 2), [credits]);

  async function loadCredits() {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await fetchMyCredits(token);
      setCredits(Array.isArray(data.credits) ? data.credits : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar tus creditos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-6">
      <LoanRecommendationCard />

      {loading ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Cargando creditos...</p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {!loading && !error && credits.length === 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800">Mis creditos</h2>
          <p className="mt-2 text-sm text-gray-600">
            Aun no tienes creditos ni solicitudes registradas.
          </p>
        </section>
      ) : null}

      {!loading && !error && credits.length > 0 ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-800">Creditos vigentes</h2>
            {activeCredits.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {activeCredits.map((credit) => (
                  <CreditCard key={credit.id} credit={credit} />
                ))}
              </div>
            ) : (
              <EmptyState text="No tienes creditos vigentes." />
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-800">Solicitudes en procesamiento</h2>
            {processingCredits.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {processingCredits.map((credit) => (
                  <ProcessingCard key={credit.id} credit={credit} />
                ))}
              </div>
            ) : (
              <EmptyState text="No tienes solicitudes en procesamiento." />
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-800">Historial de solicitudes</h2>
            {rejectedCredits.length > 0 ? (
              <CreditsTable credits={rejectedCredits} />
            ) : (
              <EmptyState text="No tienes solicitudes rechazadas." />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function CreditCard({ credit }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-800">{credit.product}</h3>
        <StatusBadge status={credit.status} label={credit.statusLabel} />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
        <Metric label="Monto aprobado" value={money(credit.amount)} />
        <Metric label="Plazo" value={`${credit.termMonths || 0} meses`} />
        <Metric label="Cuota mensual" value={money(credit.monthlyPayment)} />
        <Metric label="Tasa mensual" value={percent(credit.interestRateMonthly)} />
        <Metric label="Fecha confirmacion" value={date(credit.confirmedAt)} />
      </div>
    </div>
  );
}

function ProcessingCard({ credit }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-800">{credit.product}</h3>
        <StatusBadge status={credit.status} label={credit.statusLabel} />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
        <Metric label="Monto solicitado" value={money(credit.amount)} />
        <Metric label="Plazo" value={`${credit.termMonths || 0} meses`} />
        <Metric label="Cuota estimada" value={money(credit.monthlyPayment)} />
        <Metric label="Fecha solicitud" value={date(credit.createdAt)} />
      </div>
    </div>
  );
}

function CreditsTable({ credits }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-3 pr-4">Producto</th>
            <th className="py-3 pr-4">Monto</th>
            <th className="py-3 pr-4">Plazo</th>
            <th className="py-3 pr-4">Estado</th>
            <th className="py-3 pr-4">Fecha</th>
            <th className="py-3">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {credits.map((credit) => (
            <tr key={credit.id} className="border-b last:border-b-0">
              <td className="py-4 pr-4 font-medium text-gray-800">{credit.product}</td>
              <td className="py-4 pr-4">{money(credit.amount)}</td>
              <td className="py-4 pr-4">{credit.termMonths || 0} meses</td>
              <td className="py-4 pr-4">
                <StatusBadge status={credit.status} label={credit.statusLabel || CREDIT_STATUS[credit.status]} />
              </td>
              <td className="py-4 pr-4">{date(credit.rejectedAt || credit.createdAt)}</td>
              <td className="py-4 text-gray-600">{credit.rejectionReason || "Sin motivo registrado"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, label }) {
  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>
      {label || CREDIT_STATUS[status] || "Procesando"}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
      {text}
    </div>
  );
}
