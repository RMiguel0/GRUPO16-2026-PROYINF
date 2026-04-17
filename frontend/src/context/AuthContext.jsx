import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "auth_session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setUser(parsed);
    } catch (error) {
      console.error("Error leyendo sesión:", error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function login({ email, password }) {
    // MVP local. Luego lo cambiamos por fetch('/api/auth/login')
    if (!email || !password) {
      throw new Error("Debes ingresar correo y contraseña.");
    }

    const fakeUser = {
      id: 1,
      name: "Usuario Banco",
      email,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fakeUser));
    setUser(fakeUser);
    setIsLoginOpen(false);

    return fakeUser;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  function openLogin() {
    setIsLoginOpen(true);
  }

  function closeLogin() {
    setIsLoginOpen(false);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoginOpen,
      login,
      logout,
      openLogin,
      closeLogin,
    }),
    [user, isLoginOpen]
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