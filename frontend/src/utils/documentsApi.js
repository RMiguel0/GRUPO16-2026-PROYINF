function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "No se pudo completar la operacion.");
    error.payload = payload;
    throw error;
  }

  return payload;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function logUploadDebug({ documentType, file, payload, ok }) {
  const document = payload?.document || {};
  const debug = payload?.debugExtraction || {};
  const fields = document.fields && typeof document.fields === "object" ? document.fields : {};

  console.groupCollapsed(
    `[OCR/PDF debug] ${ok ? "OK" : "ERROR"} ${documentType} - ${file?.name || "sin archivo"}`
  );
  console.log("Archivo enviado:", {
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });
  console.log("Estado documento:", {
    status: document.status,
    source: document.source,
    confidence: document.confidence,
    fileName: document.fileName,
    uploadedAt: document.uploadedAt,
    processedAt: document.processedAt,
  });
  console.log("Warnings:", document.warnings || []);
  console.log("Errors:", document.errors || payload?.errors || []);
  console.log("Campos parseados:");
  console.table(fields);
  console.log("rawText guardado en documents.rawText:", document.rawText || "");
  console.log("debugExtraction:", debug);
  console.log("Texto original extraido antes de limpiar:", debug.originalPreview || "");
  console.log("Texto limpio despues de sanitizar:", debug.cleanedPreview || "");
  console.log("Codigos primeros caracteres originales:", debug.originalFirstCharCodes || []);
  console.groupEnd();
}

export async function fetchMyDocuments(token) {
  const response = await fetch(`${API_BASE}/api/profile/documents`, {
    headers: authHeaders(token),
  });

  return parseResponse(response);
}

export async function uploadMyDocument(token, documentType, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/profile/documents/${documentType}/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  logUploadDebug({ documentType, file, payload, ok: response.ok });

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "No se pudo completar la operacion.");
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function updateMyDocumentFields(token, documentType, fields) {
  const response = await fetch(`${API_BASE}/api/profile/documents/${documentType}/fields`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ fields }),
  });

  return parseResponse(response);
}
