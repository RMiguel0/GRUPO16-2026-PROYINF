import React from "react";

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
  monthlyIncome: "Ingreso mensual calculado",
  bonuses: "Bonos/Comisiones",
  payrollDeductions: "Descuentos por Planilla",
  contractType: "Tipo de Contrato",

  directDebt: "Deuda Directa",
  indirectDebt: "Deuda Indirecta",
  availableCreditLines: "Lineas Disponibles",
  institutionsCount: "Registros Acreedores",
  paymentStatus: "Estado de Pago",

  startDate: "Fecha de inicio laboral",
  currentDebtMonthly: "Deuda mensual actual",
  noOfDependents: "Dependientes",
  employmentType: "Tipo de trabajador",
  employmentStatus: "Situacion laboral",
  laborStartMonth: "Mes de inicio laboral",
  laborStartYear: "A\u00f1o de inicio laboral",
  laborSeniorityMonths: "Antiguedad laboral en meses",
  loanPurpose: "Destino del credito",
  additionalIncome: "Ingresos adicionales",
  seniorityMonths: "Antiguedad en meses",

  socioEconomicPercent: "Porcentaje de nivel socioeconomico",
  householdDependents: "Personas carga en el domicilio",
  assetsCount: "Cantidad de bienes",
};

const FIELD_OPTIONS = {
  employmentType: [
    { value: "", label: "Seleccionar" },
    { value: "dependiente", label: "Dependiente" },
    { value: "independiente", label: "Independiente" },
  ],
  employmentStatus: [
    { value: "", label: "Seleccionar" },
    { value: "empleado", label: "Empleado" },
    { value: "desempleado", label: "Desempleado" },
    { value: "independiente", label: "Independiente" },
    { value: "pensionado", label: "Pensionado" },
  ],
  loanPurpose: [
    { value: "", label: "Seleccionar" },
    { value: "libre_disponibilidad", label: "Libre disponibilidad" },
    { value: "consolidacion_deudas", label: "Consolidacion de deudas" },
    { value: "educacion", label: "Educacion" },
    { value: "salud", label: "Salud" },
    { value: "emprendimiento", label: "Emprendimiento" },
    { value: "vivienda", label: "Vivienda" },
    { value: "vehiculo", label: "Vehiculo" },
  ],
};

const MONTH_OPTIONS = [
  { value: "", label: "Seleccionar" },
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function yearOptions() {
  const currentYear = new Date().getFullYear();
  const options = [{ value: "", label: "Seleccionar" }];
  for (let year = currentYear; year >= currentYear - 60; year -= 1) {
    options.push({ value: String(year), label: String(year) });
  }
  return options;
}

const NUMBER_FIELDS = new Set([
  "additionalIncome",
  "laborSeniorityMonths",
  "socioEconomicPercent",
  "householdDependents",
  "assetsCount",
]);

export default function DocumentDetailCard({
  document,
  onFieldChange,
  onSaveFields,
  onUploadDocument,
  onReprocess,
  mode = "application",
  saving = false,
  uploading = false,
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

      <DocumentPreview
        document={document}
        onUploadDocument={onUploadDocument}
        uploading={uploading}
      />

      {document.status === "processing" ? (
        <ProcessingState />
      ) : (
        <FieldsEditor document={document} onFieldChange={onFieldChange} />
      )}

      <Messages warnings={warnings} errors={errors} showVerified={showVerified} />
    </article>
  );
}

function DocumentPreview({ document, onUploadDocument, uploading }) {
  const isIdentity = document.id === "identity";
  const isMissing = document.status === "missing";
  const isError = document.status === "error";
  const hasExtractedData = !isMissing && !isError;
  const canUpload = Boolean(onUploadDocument) && !document.manual;
  const acceptsIdentityImage = document.id === "identity";
  const accept = acceptsIdentityImage
    ? "application/pdf,image/jpeg,.jpg,.jpeg"
    : "application/pdf";
  const fileKindLabel = acceptsIdentityImage ? "PDF o JPG" : "PDF";
  const panelLabel = uploading
    ? "Procesando..."
    : isError
      ? "Reintentar subida"
      : isMissing
        ? "Subir documento"
        : canUpload
          ? "Datos extraidos - Subir documento"
          : "Datos extraidos";
  const panelStateClass = isError
    ? "bg-red-50 text-red-700"
    : hasExtractedData
      ? "bg-emerald-50 text-emerald-700"
      : "bg-slate-50 text-slate-600";
  const detailText = uploading
    ? "Procesando documento"
    : isError
      ? "No procesado"
      : isMissing
        ? `Selecciona ${fileKindLabel}`
        : "Documento cargado";
  const helperText = isError
    ? "Haz clic para reintentar"
    : hasExtractedData
      ? "Haz clic para subir otro"
      : "Max. 10MB";

  return (
    <div className="mb-8 flex justify-center">
      <label
        className={`relative flex h-[200px] w-[380px] items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 via-sky-100 to-orange-50 shadow-inner ${
          canUpload ? "cursor-pointer transition hover:border-blue-300" : ""
        } ${uploading ? "opacity-70" : ""}`}
      >
        {canUpload ? (
          <input
            type="file"
            accept={accept}
            hidden
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onUploadDocument(document.id, file);
              }
              event.target.value = "";
            }}
          />
        ) : null}

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
              {fileKindLabel}
            </div>
            <p className="font-semibold text-slate-800">
              {detailText}
            </p>
            {canUpload ? (
              <p className="mt-1 text-xs text-slate-500">{helperText}</p>
            ) : null}
          </div>
        )}

        <div className={`absolute left-1/2 top-1/2 flex max-w-[240px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl px-5 py-3 text-center text-sm font-bold shadow ${panelStateClass}`}>
          {panelLabel}
        </div>
      </label>
    </div>
  );
}

function FieldsEditor({ document, onFieldChange }) {
  const fields = document.fields || {};
  const dynamicOptions = {
    ...FIELD_OPTIONS,
    laborStartMonth: MONTH_OPTIONS,
    laborStartYear: yearOptions(),
  };

  function calculateSeniorityMonths(nextFields) {
    const month = Number(nextFields.laborStartMonth);
    const year = Number(nextFields.laborStartYear);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      return "";
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return String(Math.max(0, (currentYear - year) * 12 + (currentMonth - month)));
  }

  function updateField(fieldName, value) {
    onFieldChange(document.id, fieldName, value);

    if (fieldName === "laborStartMonth" || fieldName === "laborStartYear") {
      const nextFields = {
        ...fields,
        [fieldName]: value,
      };
      onFieldChange(document.id, "laborSeniorityMonths", calculateSeniorityMonths(nextFields));
    }
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

          {dynamicOptions[fieldName] ? (
            <select
              value={value ?? ""}
              onChange={(event) =>
                updateField(fieldName, event.target.value)
              }
              className="h-11 rounded-lg border border-slate-300 px-4 text-base text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {dynamicOptions[fieldName].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={NUMBER_FIELDS.has(fieldName) ? "number" : "text"}
              min={NUMBER_FIELDS.has(fieldName) ? "0" : undefined}
              readOnly={fieldName === "laborSeniorityMonths"}
              value={value ?? ""}
              onChange={(event) =>
                updateField(fieldName, event.target.value)
              }
              className={`h-11 rounded-lg border border-slate-300 px-4 text-base text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                fieldName === "laborSeniorityMonths" ? "bg-slate-50" : ""
              }`}
            />
          )}
        </div>
      ))}
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
  const hasWarnings = (status === "processed" || status === "warning") && warnings.length > 0;
  const styles = {
    missing: "bg-slate-100 text-slate-600",
    uploaded: "bg-blue-100 text-blue-700",
    processed: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    error: "bg-red-100 text-red-700",
    manual_review: "bg-amber-100 text-amber-700",
  };

  const label = {
    missing: "Faltante",
    uploaded: "Cargado",
    processed: "Procesado",
    warning: "Con advertencias",
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
