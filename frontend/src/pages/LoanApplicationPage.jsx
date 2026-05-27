import React from "react";
import DocumentReviewPanel from "../components/DocumentReviewPanel.jsx";

export default function LoanApplicationPage() {
  const loanSummary = {
    amount: "$21.500.000 CLP",
    term: 60,
    interest: 1.2,
    monthlyPayment: "$410.675 CLP",
  };

  const initialDocuments = [
    {
      id: "identity",
      title: "Copia Cédula de Identidad",
      description: "Datos de identidad y vigencia",
      status: "processed",
      icon: "ID",
      fields: {
        nombres: "Juan Francisco",
        apellidos: "González Ramírez",
        rut: "12.345.678-9",
        fechaNacimiento: "05/09/1990",
        fechaVencimiento: "12/06/2030",
      },
      warnings: [],
    },
    {
      id: "afp",
      title: "Certificado AFP",
      description: "Certificado de remuneraciones imponibles",
      status: "pending",
      icon: "AFP",
      fields: {
        employerRut: "88.269.400-3",
        employerName: "Agencia Cia.L",
        recentTaxableIncome: "$3.020.320",
        averageTaxableIncome: "$2.920.417",
        periodRange: "04/2025 - 03/2026",
      },
      warnings: [],
    },
    {
      id: "salary",
      title: "Liquidaciones de Sueldo",
      description: "Últimas 3 liquidaciones",
      status: "pending",
      icon: "DOC",
      fields: {
        baseSalary: "$2.187.000",
        netSalary: "$2.181.213",
        bonuses: "$517.220",
        payrollDeductions: "$620.025",
        contractType: "Indefinido",
      },
      warnings: [],
    },
    {
      id: "cmf",
      title: "Informe de Deudas CMF",
      description: "Deuda directa, indirecta y líneas disponibles",
      status: "pending",
      icon: "CMF",
      fields: {
        directDebt: "$40.600.023",
        indirectDebt: "$0",
        availableCreditLines: "$1.291.340",
        institutionsCount: "10",
        paymentStatus: "Al día",
      },
      warnings: [],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-[1780px] px-8 py-7">
        <DocumentReviewPanel
          summary={loanSummary}
          initialDocuments={initialDocuments}
        />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1780px] items-center justify-between px-8">
        <div className="flex items-center gap-6 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
              D
            </span>
            <span className="font-medium">Demo</span>
          </div>
        </div>
      </div>
    </header>
  );
}

