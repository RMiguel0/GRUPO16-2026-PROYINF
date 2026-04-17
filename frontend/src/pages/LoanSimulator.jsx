import { useState, useEffect } from 'react';
import { Save, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import LoanForm from '../components/LoanForm.jsx';
import { FinancialOverview } from '../components/FinancialOverview.jsx';
import { SimulationHistory } from '../components/SimulationHistory.jsx';
import { BankComparison } from '../components/BankComparison.jsx';
import { useSimulaciones } from '../hooks/useSimulaciones.js';
import AuthMenu from "../components/AuthMenu.jsx";
import LoginModal from "../components/LoginModal.jsx";

/**
 * Main page for the loan simulator. Handles fetching of previous simulations
 * and bank rates, saving new simulations, and navigating to the application
 * form. The current calculation is managed locally and passed down to
 * child components.
 */
export function LoanSimulator() {
  const { simulaciones, guardar, cargar, eliminar } = useSimulaciones();
  const navigate = useNavigate();
  const [currentCalculation, setCurrentCalculation] = useState({
    amount: 50000,
    interestRate: 5.5,
    termMonths: 60,
    monthlyPayment: 0,
    totalInterest: 0,
    totalAmount: 0,
  });
  const [bankRates, setBankRates] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [simulacionCargada, setSimulacionCargada] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  function saveSimulation() {
    setIsSaving(true);
    try {
      guardar(currentCalculation);
      cargar(); // ← fuerza la recarga del estado desde cookies
    } catch (error) {
      console.error('Error saving simulation:', error);
      alert('Failed to save simulation');
    }
    setIsSaving(false);
  }



  function deleteSimulation(index) {
    eliminar(index);
  }

  function loadSimulations() {
    const simulaciones = recuperarsimulaciones();
    setSimulations(simulaciones);
  }

  function handleLoad(simulacion) {
    setSimulacionCargada(simulacion);
  }

  async function loadBankRates() {
    const { data, error } = await supabase
      .from('bank_rates')
      .select('*')
      .order('avg_rate', { ascending: true });

    if (error) {
      console.error('Error loading bank rates:', error);
    } else if (data) {
      setBankRates(data);
    }
  }

  function handleApplyForLoan() {
    navigate('/apply', {
      state: {
        amount: currentCalculation.amount,
        termMonths: currentCalculation.termMonths,
      },
    });
  }

  const bciData = null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              Simulador de Créditos
            </h1>
            <p className="text-sm text-gray-500">
              Compara tasas, calcula pagos y encuentra la mejor oferta
            </p>
          </div>

          <AuthMenu />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <LoanForm
              initialAmount={simulacionCargada?.amount}
              initialTermMonths={simulacionCargada?.termMonths}
              onCalculate={setCurrentCalculation}
            />
          </div>

          <div className="space-y-6">
            <FinancialOverview {...currentCalculation} />

            <button
              onClick={saveSimulation}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Simulation'}
            </button>

            <button
              onClick={handleApplyForLoan}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Aplica por este crédito
            </button>
          </div>
        </div>

        <div className="mb-6">
          <SimulationHistory
            simulations={simulaciones}
            onDelete={deleteSimulation}
            onLoad={handleLoad}
          />
        </div>

        <div>
          <BankComparison
            amount={currentCalculation.amount}
            termMonths={currentCalculation.termMonths}
            currentRate={currentCalculation.interestRate}
            bankRates={bankRates}
            bciData={null}
          />
        </div>
      </div>

      <LoginModal />
    </div>
  );
}