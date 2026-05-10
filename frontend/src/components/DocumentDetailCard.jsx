import React from "react";

const FIELD_LABELS = {
  nombres: "Nombres",
  apellidos: "Apellidos",
  rut: "RUT",
  fechaNacimiento: "Fecha de Nacimiento",
  fechaVencimiento: "Fecha de Vencimiento",

  employerRut: "RUT Empleador",
  employerName: "Nombre Empleador",
  recentTaxableIncome: "Renta Imponible Reciente",
  averageTaxableIncome: "Promedio Renta Imponible",
  periodRange: "Periodos Informados",

  baseSalary: "Sueldo Base",
  netSalary: "Sueldo Líquido",
  bonuses: "Bonos/Comisiones",
  payrollDeductions: "Descuentos por Planilla",
  contractType: "Tipo de Contrato",

  directDebt: "Deuda Directa",
  indirectDebt: "Deuda Indirecta",
  availableCreditLines: "Líneas Disponibles",
  institutionsCount: "Registros Acreedores",
  paymentStatus: "Estado de Pago",
};

export default function DocumentDetailCard({
  document,
  onFieldChange,
  onMockProcess,
}) {
  if (!document) return null;

  return (
    <article className="min-h-[735px] rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <header className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-sm font-bold text-red-600">
            {document.icon}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{document.title}</h2>
          <StatusBadge status={document.status} />
        </div>

        <button
          type="button"
          onClick={() => onMockProcess(document.id)}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ↻ Reprocesar
        </button>
      </header>

      <DocumentPreview document={document} />

      {document.status === "processing" ? (
        <ProcessingState />
      ) : (
        <FieldsEditor document={document} onFieldChange={onFieldChange} />
      )}

      <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500 text-sm">
            ✓
          </span>
          <div>
            <p className="font-bold">OCR verificado correctamente</p>
            <p className="mt-1 text-sm">
              Todos los datos obligatorios fueron extraídos.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function DocumentPreview({ document }) {
  const isIdentity = document.id === "identity";

  return (
    <div className="mb-8 flex justify-center">
      <div className="relative flex h-[200px] w-[380px] items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 via-sky-100 to-orange-50 shadow-inner">
        {isIdentity ? (
          <div className="h-[155px] w-[300px] rounded-xl border border-sky-200 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-blue-700">
              <span>REPÚBLICA DE CHILE</span>
              <span>★</span>
            </div>
            <div className="mt-4 flex gap-4">
              <div className="h-20 w-16 rounded-lg bg-slate-300" />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded bg-slate-300" />
                <div className="h-3 w-4/5 rounded bg-slate-300" />
                <div className="h-3 w-3/5 rounded bg-slate-300" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-white text-2xl shadow">
              📄
            </div>
            <p className="font-semibold text-slate-800">Documento analizado</p>
          </div>
        )}

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-600">
            ✓
          </span>
          Datos extraídos
        </div>
      </div>
    </div>
  );
}

function FieldsEditor({ document, onFieldChange }) {
  return (
    <div className="space-y-4">
      {Object.entries(document.fields || {}).map(([fieldName, value]) => (
        <div key={fieldName} className="grid grid-cols-[230px_24px_1fr_42px] items-center gap-3">
          <label className="text-base text-slate-700">
            {FIELD_LABELS[fieldName] || fieldName}
          </label>

          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
            ✓
          </span>

          <input
            type="text"
            value={value}
            onChange={(event) =>
              onFieldChange(document.id, fieldName, event.target.value)
            }
            className="h-11 rounded-lg border border-slate-300 px-4 text-base text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ✎
          </button>
        </div>
      ))}
    </div>
  );
}

function ProcessingState() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-4">
      <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="font-medium text-slate-600">Extrayendo datos...</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    processed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    error: "bg-red-100 text-red-700",
  };

  const label = {
    processed: "Procesado",
    pending: "Pendiente",
    processing: "Procesando",
    error: "Error",
  }[status];

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${styles[status]}`}>
      {label}
    </span>
  );
}
