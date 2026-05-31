import React from "react";

export default function CreditSummaryCard({ summary }) {
  const rows = [
    ["Monto Solicitado:", summary.amount],
    ["Plazo:", `${summary.term} meses`],
    ["Tasa Mensual:", `${summary.interest}%`],
    ["Cuota Estimada:", summary.monthlyPayment],
    ...(summary.totalInterest ? [["Intereses:", summary.totalInterest]] : []),
    ...(summary.totalAmount ? [["Total a Pagar:", summary.totalAmount]] : []),
  ];

  return (
    <article className="min-h-[850px] rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">
        Resumen de su Solicitud de Credito -{" "}
        <span className="text-emerald-600">Confirmado</span>
      </h2>

      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-5">
            <span className="text-base text-slate-700">{label}</span>
            <span className="text-base font-bold text-slate-900">{value}</span>
          </div>
        ))}
      </div>

      <section className="mt-7 space-y-5">
        <h3 className="font-bold text-slate-900">Detalles adicionales</h3>
        <DetailRow label="Tipo de Credito:" value="Credito Personal" />
        <DetailRow label="Fecha de Simulacion:" value={summary.simulatedAt || "Actual"} />
        <DetailRow
          label="Estado:"
          value={
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              Pendiente
            </span>
          }
        />
      </section>

      <div className="mt-10 rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-700">
        <strong className="mr-1">i</strong>
        Estos valores son referenciales. El monto final puede variar segun la
        evaluacion de credito y documentos entregados.
      </div>
    </article>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
