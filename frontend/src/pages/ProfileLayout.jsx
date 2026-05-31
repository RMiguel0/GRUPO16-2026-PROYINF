import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, CreditCard, FileText, User } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProfileLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const isCreditsActive = location.pathname === "/perfil/mis-creditos";
  const isDocumentsActive = location.pathname === "/perfil/mis-documentos";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Area privada</h1>
            <p className="text-sm text-gray-500">Consulta tus productos y solicitudes</p>
          </div>

          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>{user?.email}</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 h-fit">
          <nav className="space-y-2">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al inicio
            </Link>

            <div className="my-3 border-t border-gray-100" />

            <Link
              to="/perfil/mis-creditos"
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                isCreditsActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Mis Creditos
            </Link>

            <Link
              to="/perfil/mis-documentos"
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                isDocumentsActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FileText className="w-5 h-5" />
              Mis Documentos
            </Link>
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
