import { useEffect, useMemo, useState } from "react";
import DocumentReviewPanel from "../components/DocumentReviewPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchMyDocuments,
  updateMyDocumentFields,
  uploadMyDocument,
} from "../utils/documentsApi.js";
import { mapDocumentsRowToPanelDocuments } from "../utils/documentMappers.js";

export default function MisDocumentosPage() {
  const { token, user } = useAuth();
  const [documentsByType, setDocumentsByType] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState(null);
  const [savingDocumentId, setSavingDocumentId] = useState(null);

  const documents = useMemo(
    () => mapDocumentsRowToPanelDocuments(documentsByType),
    [documentsByType]
  );

  async function loadDocuments() {
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const data = await fetchMyDocuments(token);
      setDocumentsByType(data.documents || {});
    } catch (err) {
      setError(err.message || "No se pudieron cargar tus documentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function patchDocument(documentType, updater) {
    setDocumentsByType((current) => {
      const previous = current[documentType] || {};
      return {
        ...current,
        [documentType]: typeof updater === "function" ? updater(previous) : updater,
      };
    });
  }

  function handleFieldChange(documentType, fieldName, value) {
    patchDocument(documentType, (previous) => ({
      ...previous,
      status: previous.status === "missing" ? "manual_review" : previous.status,
      fields: {
        ...(previous.fields || {}),
        [fieldName]: value,
      },
    }));
  }

  async function handleUploadDocument(documentType, file) {
    setUploadingDocumentId(documentType);
    setError("");
    patchDocument(documentType, (previous) => ({
      ...previous,
      status: "processing",
      fileName: file.name,
      mimeType: file.type,
      errors: [],
    }));

    try {
      const data = await uploadMyDocument(token, documentType, file);
      patchDocument(documentType, data.document || {});
    } catch (err) {
      if (err.payload?.document) {
        patchDocument(documentType, err.payload.document);
      }
      setError(err.message || "No se pudo procesar el documento.");
    } finally {
      setUploadingDocumentId(null);
    }
  }

  async function handleSaveFields(documentType, fields) {
    setSavingDocumentId(documentType);
    setError("");
    try {
      const data = await updateMyDocumentFields(token, documentType, fields || {});
      patchDocument(documentType, data.document || {});
    } catch (err) {
      setError(err.message || "No se pudieron guardar los campos.");
    } finally {
      setSavingDocumentId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Mis Documentos</h2>
            <p className="mt-1 text-sm text-gray-600">
              Documentos asociados al RUT {user?.rut || "sin RUT registrado"}.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDocuments}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Actualizar
          </button>
        </div>
      </section>

      <DocumentReviewPanel
        mode="profile"
        documents={documents}
        loading={loading}
        error={error}
        uploadingDocumentId={uploadingDocumentId}
        savingDocumentId={savingDocumentId}
        onUploadDocument={handleUploadDocument}
        onFieldChange={handleFieldChange}
        onSaveFields={handleSaveFields}
      />
    </div>
  );
}
