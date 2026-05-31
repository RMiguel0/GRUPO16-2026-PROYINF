import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { normalizarRUT, validarRUT } from "../utils/rutUtils.js";

export default function LoginModal() {
  const { isLoginOpen, authMode, closeLogin, login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    rut: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoginOpen) {
      setMode(authMode);
      setError("");
    }
  }, [isLoginOpen, authMode]);

  if (!isLoginOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const normalizedRut = normalizarRUT(form.rut);
        if (!validarRUT(normalizedRut)) {
          setError("RUT invalido. Usa el formato 12345678-9.");
          setLoading(false);
          return;
        }

        await register({ ...form, rut: normalizedRut });
      } else {
        await login(form);
      }
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setError("");
    setMode((prev) => (prev === "login" ? "register" : "login"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {mode === "register" ? "Crear cuenta" : "Iniciar sesion"}
            </h2>
            <p className="text-sm text-gray-500">Accede a tu area privada</p>
          </div>

          <button
            onClick={closeLogin}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            type="button"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {mode === "register" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Perez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT
                </label>
                <input
                  type="text"
                  required
                  value={form.rut}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, rut: e.target.value }))
                  }
                  onBlur={() =>
                    setForm((prev) => ({ ...prev, rut: normalizarRUT(prev.rut) }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12345678-9"
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="correo@ejemplo.cl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrasena
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimo 8 caracteres"
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 transition-colors"
          >
            {loading
              ? "Procesando..."
              : mode === "register"
                ? "Crear cuenta"
                : "Iniciar sesion"}
          </button>

          <button
            type="button"
            onClick={switchMode}
            className="w-full rounded-xl border border-gray-300 text-gray-700 font-semibold py-3 hover:bg-gray-50 transition-colors"
          >
            {mode === "register" ? "Ya tengo cuenta" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
