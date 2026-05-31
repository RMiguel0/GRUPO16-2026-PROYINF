import React from "react";

const STATUS_LABELS = {
  missing: "Faltante",
  processed: "Procesado",
  pending: "Pendiente",
  processing: "Procesando",
  error: "Error",
  manual_review: "Revisar",
};

export default function DocumentList({ documents, selectedId, onSelect }) {
  return (
    <div className="space-y-4">
      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          onClick={() => onSelect(document.id)}
          className={`w-full rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 ${
            selectedId === document.id
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-blue-600">
              {document.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-base font-bold text-slate-900">
                  {document.title}
                </h3>
                <StatusBadge status={document.status} warnings={document.warnings} />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {document.description}
              </p>
            </div>

            {document.status === "processed" ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
                OK
              </span>
            ) : document.status === "manual_review" ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-sm text-white">
                !
              </span>
            ) : (
              <span className="h-6 w-6 rounded-full border-2 border-dashed border-slate-300" />
            )}
          </div>
        </button>
      ))}
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

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        hasWarnings ? "bg-amber-100 text-amber-700" : styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {hasWarnings ? "Con advertencias" : STATUS_LABELS[status] || status}
    </span>
  );
}
