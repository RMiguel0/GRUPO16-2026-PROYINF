import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "auth_session";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (!envBase || envBase.includes("://api:")) return "http://localhost:3000";
  return envBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

async function requestAuth(path, { token, ...options } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la operacion.");
  }

  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    async function restoreSession() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setInitializing(false);
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const data = await requestAuth("/api/auth/me", { token: parsed.token });
        const restored = { ...parsed, user: data.user };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
        setSession(restored);
      } catch (error) {
        console.error("Error leyendo sesion:", error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setInitializing(false);
      }
    }

    restoreSession();
  }, []);

  function saveSession(data) {
    const nextSession = {
      token: data.token,
      expiresAt: data.expiresAt,
      user: data.user,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setIsLoginOpen(false);

    return nextSession.user;
  }

  async function login({ email, password }) {
    const data = await requestAuth("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    return saveSession(data);
  }

  async function register({ fullName, email, password, rut }) {
    const data = await requestAuth("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password, rut }),
    });

    return saveSession(data);
  }

  async function logout() {
    const token = session?.token;
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);

    if (token) {
      try {
        await requestAuth("/api/auth/logout", {
          method: "POST",
          token,
        });
      } catch (error) {
        console.error("Error cerrando sesion:", error);
      }
    }
  }

  function openLogin(mode = "login") {
    setAuthMode(mode === "register" ? "register" : "login");
    setIsLoginOpen(true);
  }

  function closeLogin() {
    setIsLoginOpen(false);
  }

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      initializing,
      isAuthenticated: Boolean(session?.user),
      isLoginOpen,
      authMode,
      login,
      register,
      logout,
      openLogin,
      closeLogin,
    }),
    [session, initializing, isLoginOpen, authMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
