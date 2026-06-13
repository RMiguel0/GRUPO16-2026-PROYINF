// src/components/canvas_firma.jsx
import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useAuth } from "../context/AuthContext.jsx";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

export default function CanvasFirma({ creditId, email, datosContrato }) {
  const ref = useRef();
  const { token } = useAuth();                    // ← aquí "dentro del componente"
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const guardarFirma = async () => {
    if (!ref.current || ref.current.isEmpty()) {
      setError("Por favor dibuja tu firma antes de enviar.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess(false);

    try {
      const firmaBase64 = ref.current.getCanvas().toDataURL("image/png");

      const response = await fetch(`${API_BASE}/api/loans/firmar-prestamo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),  // ← aquí el header
        },
        body: JSON.stringify({
          firmaBase64,
          destinatario: email || "cliente@ejemplo.com",
          creditId,
          datosContrato,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Error al enviar la firma.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || "No se pudo enviar la firma.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="text-center">
      <h3 className="font-medium mb-2">Firma digital del cliente</h3>
      <SignatureCanvas
        ref={ref}
        penColor="black"
        canvasProps={{
          width: 500,
          height: 200,
          className: "border rounded-md firma-canvas",
        }}
      />
      <div className="mt-3 flex gap-2 justify-center">
        <button
          onClick={guardarFirma}
          disabled={sending}
          className="px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: sending ? "#666666" : "#000000" }}
        >
          {sending ? "Enviando..." : "Guardar y enviar firma"}
        </button>
        <button
          onClick={() => ref.current.clear()}
          className="px-4 py-2 rounded-lg border"
        >
          Limpiar
        </button>
      </div>
      {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}
      {success && <p className="text-green-600 mt-2 text-sm">Firma enviada correctamente.</p>}
    </div>
  );
}