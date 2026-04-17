import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoanSimulator } from "./pages/LoanSimulator.jsx";
import { LoanApplicationForm } from "./pages/LoanApplicationForm.jsx";
import ContractReview from "./pages/ContractReview.jsx";
import IdentityCheck from "./pages/IdentityCheck.jsx";
import BciTestPage from "./pages/BciTestPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProfileLayout from "./pages/ProfileLayout.jsx";
import MisCreditosPage from "./pages/MisCreditosPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoanSimulator />} />
        <Route path="/apply" element={<LoanApplicationForm />} />
        <Route path="/identity-check" element={<IdentityCheck />} />
        <Route path="/contract-review" element={<ContractReview />} />
        <Route path="/bci-test" element={<BciTestPage />} />

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;