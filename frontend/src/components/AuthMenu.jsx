import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User, UserPlus, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthMenu() {
  const { isAuthenticated, user, logout, openLogin } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToProfile() {
    setOpen(false);
    navigate("/perfil/mis-creditos");
  }

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
      >
        <span className="hidden sm:inline">
          {isAuthenticated ? user?.name || "Mi cuenta" : "Mi cuenta"}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden z-40">
          {!isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openLogin();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogIn className="w-4 h-4" />
                Log in
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 border-t"
              >
                <UserPlus className="w-4 h-4" />
                Sign in
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={goToProfile}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="w-4 h-4" />
                Perfil
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 border-t"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}