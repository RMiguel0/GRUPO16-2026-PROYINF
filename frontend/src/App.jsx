import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoanSimulator } from "./pages/LoanSimulator.jsx";
import LoanApplicationPage from "./pages/LoanApplicationPage.jsx";
import ContractReview from "./pages/ContractReview.jsx";
import IdentityCheck from "./pages/IdentityCheck.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProfileLayout from "./pages/ProfileLayout.jsx";
import MisCreditosPage from "./pages/MisCreditosPage.jsx";
import MisDocumentosPage from "./pages/MisDocumentosPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoanSimulator />} />
        <Route path="/apply" element={<LoanApplicationPage />} />
        <Route path="/identity-check" element={<IdentityCheck />} />
        <Route path="/contract-review" element={<ContractReview />} />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfileLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="mis-creditos" replace />} />
          <Route path="mis-creditos" element={<MisCreditosPage />} />
          <Route path="mis-documentos" element={<MisDocumentosPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
