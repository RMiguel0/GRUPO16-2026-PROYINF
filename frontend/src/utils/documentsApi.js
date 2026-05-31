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

  return parseResponse(response);
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
