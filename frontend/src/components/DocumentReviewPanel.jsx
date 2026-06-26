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
  onBack,
  onManageDocuments,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continuar Evaluacion",
  backLabel = "Volver al Resumen",
  manageDocumentsLabel = "Gestionar documentos",
  footerHint = "",
}) {
  const isProfile = mode === "profile";
  const isControlled = Array.isArray(controlledDocuments);
  const [localDocuments, setLocalDocuments] = useState(initialDocuments);
  const documents = isControlled ? controlledDocuments : localDocuments;
  const employmentType = String(
    documents.find((document) => document.id === "financial_profile")?.fields?.employmentType || ""
  ).toLowerCase();
  const hidesIncomeDocuments = employmentType === "independiente";
  const visibleDocuments = hidesIncomeDocuments
    ? documents.filter((document) => !document.incomeDocument)
    : documents;
  const [selectedId, setSelectedId] = useState(visibleDocuments[0]?.id || null);

  useEffect(() => {
    if (!visibleDocuments.some((document) => document.id === selectedId)) {
      setSelectedId(visibleDocuments[0]?.id || null);
    }
  }, [visibleDocuments, selectedId]);

  const selectedDocument = useMemo(
    () => visibleDocuments.find((document) => document.id === selectedId),
    [visibleDocuments, selectedId]
  );

  const completedCount = visibleDocuments.filter((doc) =>
    ["processed", "manual_review", "warning", "uploaded"].includes(doc.status)
  ).length;
  const canReprocess = Boolean(onReprocess) || !isControlled;

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
            <p className="mt-2 text-base leading-4 text-slate-600">
              {isProfile
                ? "Carga y corrige tus documentos para reutilizarlos en futuras solicitudes."
                : "Sube los documentos solicitados. Extraeremos la informacion automaticamente para agilizar tu solicitud."}
            </p>
          </div>

          {!isProfile && onManageDocuments ? (
            <button
              type="button"
              onClick={onManageDocuments}
              className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              {manageDocumentsLabel}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <DocumentList
          documents={visibleDocuments}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        {hidesIncomeDocuments ? (
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            Perfil independiente: no se solicitara liquidacion de sueldo ni certificado AFP.
          </div>
        ) : null}

      </section>

      <section className={detailColumnClass}>
        <DocumentDetailCard
          document={selectedDocument}
          onFieldChange={handleFieldChange}
          onSaveFields={onSaveFields}
          onUploadDocument={onUploadDocument}
          onReprocess={!isProfile && canReprocess ? handleMockProcess : null}
          mode={mode}
          saving={savingDocumentId === selectedDocument?.id}
          uploading={uploadingDocumentId === selectedDocument?.id}
        />
      </section>

      <footer className="col-span-12 mt-2 border-t border-slate-200 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-lg bg-blue-50 px-5 py-3 text-sm text-blue-700">
            Documentos cargados:{" "}
            <strong>
              {completedCount}/{visibleDocuments.length}
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
            <div className="flex flex-col gap-3 sm:items-end">
              {footerHint ? (
                <p className="max-w-md text-sm text-slate-600">{footerHint}</p>
              ) : null}
              <div className="flex gap-5">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  {backLabel}
                </button>
                {onManageDocuments ? (
                  <button
                    type="button"
                    onClick={onManageDocuments}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-7 py-3 font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
                  >
                    {manageDocumentsLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={continueDisabled}
                  className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {continueLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </footer>
    </section>
  );
}
