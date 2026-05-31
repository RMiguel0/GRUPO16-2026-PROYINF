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

export async function fetchMyCredits(token) {
  const response = await fetch(`${API_BASE}/api/profile/credits`, {
    headers: authHeaders(token),
  });

  return parseResponse(response);
}
