import React, { useState } from "react";

const FIELD_LABELS = {
  nombres: "Nombres",
  apellidos: "Apellidos",
  rut: "RUT",
  fullName: "Nombre completo",
  birthDate: "Fecha de nacimiento",
  docNumber: "Numero de documento",
  expiryDate: "Fecha de vencimiento",

  employerRut: "RUT Empleador",
  employerName: "Nombre Empleador",
  recentTaxableIncome: "Renta Imponible Reciente",
  averageTaxableIncome: "Promedio Renta Imponible",
  periodRange: "Periodos Informados",

  baseSalary: "Sueldo Base",
  netSalary: "Sueldo Liquido",
  bonuses: "Bonos/Comisiones",
  payrollDeductions: "Descuentos por Planilla",
  contractType: "Tipo de Contrato",

  directDebt: "Deuda Directa",
  indirectDebt: "Deuda Indirecta",
  availableCreditLines: "Lineas Disponibles",
  institutionsCount: "Registros Acreedores",
  paymentStatus: "Estado de Pago",

  startDate: "Fecha de inicio laboral",
  monthlyIncome: "Ingreso mensual",
  currentDebtMonthly: "Deuda mensual actual",
  noOfDependents: "Dependientes",
  employmentStatus: "Situacion laboral",
};

export default function DocumentDetailCard({
  document,
  onFieldChange,
  onSaveFields,
  onReprocess,
  mode = "application",
  saving = false,
}) {
  if (!document) return null;

  const warnings = Array.isArray(document.warnings) ? document.warnings : [];
  const errors = Array.isArray(document.errors) ? document.errors : [];
  const showVerified = document.status === "processed" && warnings.length === 0 && errors.length === 0;

  return (
    <article className="min-h-[620px] rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-sm font-bold text-red-600">
            {document.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{document.title}</h2>
            {document.fileName ? (
              <p className="mt-1 text-xs text-slate-500">{document.fileName}</p>
            ) : null}
          </div>
          <StatusBadge status={document.status} warnings={warnings} />
        </div>

        <div className="flex gap-3">
          {onReprocess ? (
            <button
              type="button"
              onClick={() => onReprocess(document.id)}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Reprocesar
            </button>
          ) : null}

          {onSaveFields ? (
            <button
              type="button"
              onClick={() => onSaveFields?.(document.id, document.fields || {})}
              disabled={saving || document.status === "processing"}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving ? "Guardando..." : "Guardar campos"}
            </button>
          ) : null}
        </div>
      </header>

      <DocumentPreview document={document} />

      {document.status === "processing" ? (
        <ProcessingState />
      ) : (
        <FieldsEditor document={document} onFieldChange={onFieldChange} />
      )}

      <Messages warnings={warnings} errors={errors} showVerified={showVerified} />
    </article>
  );
}

function DocumentPreview({ document }) {
  const isIdentity = document.id === "identity";
  const isMissing = document.status === "missing";

  return (
    <div className="mb-8 flex justify-center">
      <div className="relative flex h-[200px] w-[380px] items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 via-sky-100 to-orange-50 shadow-inner">
        {isIdentity ? (
          <div className="h-[155px] w-[300px] rounded-xl border border-sky-200 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-blue-700">
              <span>REPUBLICA DE CHILE</span>
              <span>ID</span>
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
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-white text-sm font-bold shadow">
              PDF
            </div>
            <p className="font-semibold text-slate-800">
              {isMissing ? "Documento pendiente" : "Documento cargado"}
            </p>
          </div>
        )}

        <div className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow ${
          isMissing ? "bg-slate-50 text-slate-600" : "bg-emerald-50 text-emerald-700"
        }`}>
          {isMissing ? "Sin datos" : "Datos extraidos"}
        </div>
      </div>
    </div>
  );
}

function FieldsEditor({ document, onFieldChange }) {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const fields = document.fields || {};

  function addField() {
    const fieldName = newFieldName.trim();
    if (!fieldName) return;

    onFieldChange(document.id, fieldName, newFieldValue);
    setNewFieldName("");
    setNewFieldValue("");
  }

  return (
    <div className="space-y-4">
      {Object.entries(fields).length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No hay campos extraidos todavia. Puedes cargar un PDF o agregar campos manualmente.
        </div>
      ) : null}

      {Object.entries(fields).map(([fieldName, value]) => (
        <div key={fieldName} className="grid grid-cols-[180px_1fr] items-center gap-3 lg:grid-cols-[230px_1fr]">
          <label className="text-base text-slate-700">
            {FIELD_LABELS[fieldName] || fieldName}
          </label>

          <input
            type="text"
            value={value ?? ""}
            onChange={(event) =>
              onFieldChange(document.id, fieldName, event.target.value)
            }
            className="h-11 rounded-lg border border-slate-300 px-4 text-base text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      ))}

      <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={newFieldName}
          onChange={(event) => setNewFieldName(event.target.value)}
          placeholder="campo"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <input
          type="text"
          value={newFieldValue}
          onChange={(event) => setNewFieldValue(event.target.value)}
          placeholder="valor"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={addField}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function Messages({ warnings, errors, showVerified }) {
  if (errors.length > 0) {
    return (
      <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <p className="font-bold">No se pudo procesar el documento</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (warnings.length > 0) {
    return (
      <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
        <p className="font-bold">Requiere revision manual</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!showVerified) return null;

  return (
    <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
      <p className="font-bold">OCR verificado correctamente</p>
      <p className="mt-1 text-sm">Todos los datos obligatorios fueron extraidos.</p>
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

function StatusBadge({ status, warnings = [] }) {
  const hasWarnings = status === "processed" && warnings.length > 0;
  const styles = {
    missing: "bg-slate-100 text-slate-600",
    processed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    error: "bg-red-100 text-red-700",
    manual_review: "bg-amber-100 text-amber-700",
  };

  const label = {
    missing: "Faltante",
    processed: "Procesado",
    pending: "Pendiente",
    processing: "Procesando",
    error: "Error",
    manual_review: "Revisar",
  }[status] || status;

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${
      hasWarnings ? "bg-amber-100 text-amber-700" : styles[status] || "bg-slate-100 text-slate-600"
    }`}>
      {hasWarnings ? "Con advertencias" : label}
    </span>
  );
}
