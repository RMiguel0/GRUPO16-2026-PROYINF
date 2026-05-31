import React, { useEffect, useMemo, useState } from "react";
import CreditSummaryCard from "./CreditSummaryCard.jsx";
import DocumentList from "./DocumentList.jsx";
import DocumentDetailCard from "./DocumentDetailCard.jsx";

export default function DocumentReviewPanel({
  mode = "application",
  summary,
  initialDocuments = [],
  documents: controlledDocuments,
  loading = false,
  error = "",
  uploadingDocumentId = null,
  savingDocumentId = null,
  onUploadDocument,
  onFieldChange,
  onSaveFields,
  onReprocess,
}) {
  const isProfile = mode === "profile";
  const isControlled = Array.isArray(controlledDocuments);
  const [localDocuments, setLocalDocuments] = useState(initialDocuments);
  const documents = isControlled ? controlledDocuments : localDocuments;
  const [selectedId, setSelectedId] = useState(documents[0]?.id || null);

  useEffect(() => {
    if (!documents.some((document) => document.id === selectedId)) {
      setSelectedId(documents[0]?.id || null);
    }
  }, [documents, selectedId]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId),
    [documents, selectedId]
  );

  const completedCount = documents.filter((doc) =>
    ["processed", "manual_review"].includes(doc.status)
  ).length;

  const handleSelect = (id) => setSelectedId(id);

  const handleFieldChange = (documentId, fieldName, value) => {
    if (onFieldChange) {
      onFieldChange(documentId, fieldName, value);
      return;
    }

    setLocalDocuments((current) =>
      current.map((document) => {
        if (document.id !== documentId) return document;

        return {
          ...document,
          fields: {
            ...document.fields,
            [fieldName]: value,
          },
        };
      })
    );
  };

  const handleMockProcess = (documentId) => {
    if (onReprocess) {
      onReprocess(documentId);
      return;
    }

    setLocalDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? { ...document, status: "processing" }
          : document
      )
    );

    setTimeout(() => {
      setLocalDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? { ...document, status: "processed", warnings: [] }
            : document
        )
      );
    }, 800);
  };

  const leftColumnClass = isProfile ? "col-span-12 lg:col-span-4" : "col-span-12 lg:col-span-3";
  const detailColumnClass = isProfile ? "col-span-12 lg:col-span-8" : "col-span-12 lg:col-span-5";

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        Cargando documentos...
      </section>
    );
  }

  return (
    <section className="grid grid-cols-12 gap-6 lg:gap-9">
      {!isProfile && summary ? (
        <aside className="col-span-12 lg:col-span-4">
          <CreditSummaryCard summary={summary} />
        </aside>
      ) : null}

      <section className={leftColumnClass}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Documentos requeridos
            </h1>
            <p className="mt-2 text-base leading-6 text-slate-600">
              {isProfile
                ? "Carga y corrige tus documentos para reutilizarlos en futuras solicitudes."
                : "Sube los documentos solicitados. Extraeremos la informacion automaticamente para agilizar tu solicitud."}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <DocumentList
          documents={documents}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <UploadDropzone
          selectedDocument={selectedDocument}
          onUploadDocument={onUploadDocument}
          disabled={!onUploadDocument || uploadingDocumentId !== null}
        />
      </section>

      <section className={detailColumnClass}>
        <DocumentDetailCard
          document={selectedDocument}
          onFieldChange={handleFieldChange}
          onSaveFields={onSaveFields}
          onReprocess={isProfile ? null : handleMockProcess}
          mode={mode}
          saving={savingDocumentId === selectedDocument?.id}
        />
      </section>

      <footer className="col-span-12 mt-2 border-t border-slate-200 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-lg bg-blue-50 px-5 py-3 text-sm text-blue-700">
            Documentos cargados:{" "}
            <strong>
              {completedCount}/{documents.length}
            </strong>
          </div>

          {isProfile ? (
            <button
              type="button"
              onClick={() => selectedDocument && onSaveFields?.(selectedDocument.id, selectedDocument.fields || {})}
              disabled={!selectedDocument || savingDocumentId === selectedDocument?.id}
              className="rounded-lg bg-blue-600 px-7 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300"
            >
              {savingDocumentId === selectedDocument?.id ? "Guardando..." : "Guardar cambios"}
            </button>
          ) : (
            <div className="flex gap-5">
              <button className="rounded-lg border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                Volver al Resumen
              </button>
              <button className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-sm hover:bg-blue-700">
                Continuar Evaluacion
              </button>
            </div>
          )}
        </div>
      </footer>
    </section>
  );
}

function UploadDropzone({ selectedDocument, onUploadDocument, disabled }) {
  const label = selectedDocument
    ? `Selecciona un PDF para ${selectedDocument.title}`
    : "Selecciona un documento";

  return (
    <label
      className={`mt-7 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center shadow-sm transition hover:border-blue-300 ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <input
        type="file"
        accept="application/pdf"
        hidden
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && selectedDocument) {
            onUploadDocument(selectedDocument.id, file);
          }
          event.target.value = "";
        }}
      />
      <div className="mb-4 text-sm font-bold text-slate-400">PDF</div>
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-sm text-slate-500">El backend procesara el archivo con iLovePDF</p>
      <p className="mt-4 text-sm text-slate-500">PDF. Max. 10MB</p>
    </label>
  );
}
