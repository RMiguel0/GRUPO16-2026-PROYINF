import React, { useMemo, useState } from "react";
import CreditSummaryCard from "./CreditSummaryCard.jsx";
import DocumentList from "./DocumentList.jsx";
import DocumentDetailCard from "./DocumentDetailCard.jsx";

export default function DocumentReviewPanel({ summary, initialDocuments }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocuments[0]?.id || null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId),
    [documents, selectedId]
  );

  const processedCount = documents.filter((doc) => doc.status === "processed").length;

  const handleSelect = (id) => setSelectedId(id);

  const handleFieldChange = (documentId, fieldName, value) => {
    setDocuments((current) =>
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
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? { ...document, status: "processing" }
          : document
      )
    );

    setTimeout(() => {
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? { ...document, status: "processed", warnings: [] }
            : document
        )
      );
    }, 800);
  };

  return (
    <section className="grid grid-cols-12 gap-9">
      <aside className="col-span-4">
        <CreditSummaryCard summary={summary} />
      </aside>

      <section className="col-span-3">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Documentos requeridos
            </h1>
            <p className="mt-2 text-base leading-6 text-slate-600">
              Sube los documentos solicitados. Extraeremos la información
              automáticamente para agilizar tu solicitud.
            </p>
          </div>
        </div>

        <DocumentList
          documents={documents}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <UploadDropzone />
      </section>

      <section className="col-span-5">
        <div className="mb-6 flex justify-end">
          <button className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            Ver guía de documentos
          </button>
        </div>

        <DocumentDetailCard
          document={selectedDocument}
          onFieldChange={handleFieldChange}
          onMockProcess={handleMockProcess}
        />
      </section>

      <footer className="col-span-12 mt-2 border-t border-slate-200 pt-8">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-blue-50 px-5 py-3 text-sm text-blue-700">
            Documentos procesados:{" "}
            <strong>
              {processedCount}/{documents.length}
            </strong>
          </div>

          <div className="flex gap-5">
            <button className="rounded-lg border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              ← Volver al Resumen
            </button>
            <button className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-sm hover:bg-blue-700">
              Continuar Evaluación →
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}

function UploadDropzone() {
  return (
    <div className="mt-7 flex min-h-[190px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <div className="mb-4 text-5xl text-slate-400">☁️</div>
      <p className="font-semibold text-slate-800">Arrastra un archivo aquí</p>
      <p className="mt-1 text-sm text-slate-500">o haz clic para seleccionar</p>
      <p className="mt-4 text-sm text-slate-500">PDF, JPG, PNG. Máx. 10MB</p>
    </div>
  );
}
