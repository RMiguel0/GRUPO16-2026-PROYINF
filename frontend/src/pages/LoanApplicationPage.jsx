import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import DocumentReviewPanel from "../components/DocumentReviewPanel.jsx";
import LoginModal from "../components/LoginModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchMyDocuments,
  updateMyDocumentFields,
  uploadMyDocument,
} from "../utils/documentsApi.js";
import {
  getMissingApplicationRequirements,
  mapDocumentsRowToPanelDocuments,
} from "../utils/documentMappers.js";
import { formatCurrency } from "../utils/loanCalculations.js";

const PENDING_SIMULATION_KEY = "pendingLoanSimulation";
const APPLICATION_DRAFT_KEY = "loanApplicationDraft";

function readStoredSimulation() {
  try {
    const raw = sessionStorage.getItem(PENDING_SIMULATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeSimulation(source) {
  if (!source || typeof source !== "object") return null;

  const amount = Number(source.amount);
  const termMonths = Number(source.termMonths);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }

  return {
    amount,
    termMonths,
    interestRate: Number(source.interestRate) || 0,
    monthlyPayment: Number(source.monthlyPayment) || 0,
    totalInterest: Number(source.totalInterest) || 0,
    totalAmount: Number(source.totalAmount) || 0,
    simulatedAt: source.simulatedAt || new Date().toISOString(),
  };
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNumber(source, keys) {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const parsed = asNumber(source[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function pickText(source, keys) {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function getFields(document) {
  return document?.fields && typeof document.fields === "object" ? document.fields : {};
}

function resolveApplicant({ user, documentsByType }) {
  const identity = getFields(documentsByType.identity);
  const salary = getFields(documentsByType.salary);
  const afp = getFields(documentsByType.afp_imponibles);
  const debt = getFields(documentsByType.cmf_debt);
  const profile = getFields(documentsByType.financial_profile);
  const socialRegistry = getFields(documentsByType.social_registry);

  const fullName =
    pickText(identity, ["fullName", "nombreCompleto"]) ||
    [pickText(identity, ["nombres"]), pickText(identity, ["apellidos"])].filter(Boolean).join(" ") ||
    user?.name ||
    "";

  const monthlyIncome =
    pickNumber(profile, ["monthlyIncome", "monthly_income", "incomeMonthly", "netMonthlyIncome"]) ??
    pickNumber(salary, ["monthlyIncome", "netSalary", "baseSalary", "averageMonthlyIncome"]) ??
    pickNumber(afp, ["averageTaxableIncome", "recentTaxableIncome", "monthlyIncome"]) ??
    pickNumber(profile, ["additionalIncome", "additional_income"]);

  const employmentStatus =
    pickText(profile, ["employmentStatus", "employment_status"]) ||
    pickText(profile, ["employmentType", "employment_type"]) ||
    pickText(salary, ["employmentStatus", "contractType"]) ||
    pickText(afp, ["employmentStatus"]);
  const employmentType = pickText(profile, ["employmentType", "employment_type"]);
  const additionalIncome = pickNumber(profile, ["additionalIncome", "additional_income"]);

  const currentDebtMonthly =
    pickNumber({ ...debt, ...profile }, ["currentDebtMonthly", "monthlyDebt", "debtMonthly", "monthlyPayment"]) ??
    (() => {
      const directDebt = pickNumber(debt, ["directDebt", "totalDebt", "debtTotal"]);
      return directDebt !== null ? directDebt * 0.03 : null;
    })();

  return {
    fullName,
    identification: pickText(identity, ["rut", "identification"]) || user?.rut || "",
    email: user?.email || pickText(identity, ["email"]),
    phone: user?.phone || pickText(profile, ["phone"]) || pickText(identity, ["phone"]),
    monthlyIncome,
    employmentStatus,
    currentDebtMonthly,
    noOfDependents: pickNumber(socialRegistry, ["householdDependents", "noOfDependents", "dependents", "cargasFamiliares"]),
    employmentType,
    laborStartMonth: pickNumber(profile, ["laborStartMonth"]),
    laborStartYear: pickNumber(profile, ["laborStartYear"]),
    laborSeniorityMonths: pickNumber(profile, ["laborSeniorityMonths", "seniorityMonths"]),
    loanPurpose: pickText(profile, ["loanPurpose", "loan_purpose"]),
    additionalIncome,
    socialRegistry: {
      socioEconomicPercent: pickNumber(socialRegistry, ["socioEconomicPercent"]),
      assetsCount: pickNumber(socialRegistry, ["assetsCount"]),
    },
  };
}

export default function LoanApplicationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, initializing, isAuthenticated, openLogin } = useAuth();
  const [simulation] = useState(() =>
    normalizeSimulation(location.state) || normalizeSimulation(readStoredSimulation())
  );
  const [documentsByType, setDocumentsByType] = useState({});
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [error, setError] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState(null);
  const [savingDocumentId, setSavingDocumentId] = useState(null);

  useEffect(() => {
    if (!simulation) return;
    try {
      sessionStorage.setItem(PENDING_SIMULATION_KEY, JSON.stringify(simulation));
    } catch {}
  }, [simulation]);

  const documents = useMemo(
    () => mapDocumentsRowToPanelDocuments(documentsByType),
    [documentsByType]
  );

  const applicant = useMemo(
    () => resolveApplicant({ user, documentsByType }),
    [user, documentsByType]
  );

  const loanSummary = useMemo(() => {
    if (!simulation) return null;
    return {
      amount: formatCurrency(simulation.amount),
      term: simulation.termMonths,
      interest: simulation.interestRate,
      monthlyPayment: formatCurrency(simulation.monthlyPayment),
      totalInterest: formatCurrency(simulation.totalInterest),
      totalAmount: formatCurrency(simulation.totalAmount),
      simulatedAt: new Date(simulation.simulatedAt).toLocaleDateString("es-CL"),
    };
  }, [simulation]);

  const missingDocumentRequirements = useMemo(
    () => getMissingApplicationRequirements(documents),
    [documents]
  );

  const missingApplicantRequirements = useMemo(() => {
    const missing = [];
    const isIndependent = applicant.employmentType === "independiente";
    if (!applicant.employmentType) {
      missing.push("Tipo de trabajador");
    }
    if (!applicant.monthlyIncome || applicant.monthlyIncome <= 0) {
      missing.push("Ingreso mensual");
    }
    if (!applicant.employmentStatus) {
      missing.push("Situacion laboral");
    }
    if (isIndependent && (!applicant.additionalIncome || applicant.additionalIncome <= 0)) {
      missing.push("Ingresos adicionales");
    }
    return missing;
  }, [applicant]);

  const blockingRequirements = useMemo(
    () => [...missingDocumentRequirements, ...missingApplicantRequirements],
    [missingDocumentRequirements, missingApplicantRequirements]
  );

  async function loadDocuments() {
    if (!token) return;

    setLoadingDocuments(true);
    setError("");
    try {
      const data = await fetchMyDocuments(token);
      setDocumentsByType(data.documents || {});
    } catch (err) {
      setError(err.message || "No se pudieron cargar tus documentos.");
    } finally {
      setLoadingDocuments(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  function patchDocument(documentType, updater) {
    setDocumentsByType((current) => {
      const previous = current[documentType] || {};
      return {
        ...current,
        [documentType]: typeof updater === "function" ? updater(previous) : updater,
      };
    });
  }

  function handleFieldChange(documentType, fieldName, value) {
    patchDocument(documentType, (previous) => ({
      ...previous,
      status: previous.status === "missing" ? "manual_review" : previous.status,
      fields: {
        ...(previous.fields || {}),
        [fieldName]: value,
      },
    }));
  }

  async function handleUploadDocument(documentType, file) {
    setUploadingDocumentId(documentType);
    setError("");
    patchDocument(documentType, (previous) => ({
      ...previous,
      status: "processing",
      fileName: file.name,
      mimeType: file.type,
      errors: [],
    }));

    try {
      const data = await uploadMyDocument(token, documentType, file);
      patchDocument(documentType, data.document || {});
    } catch (err) {
      if (err.payload?.document) {
        patchDocument(documentType, err.payload.document);
      }
      setError(err.message || "No se pudo procesar el documento.");
    } finally {
      setUploadingDocumentId(null);
    }
  }

  async function handleSaveFields(documentType, fields) {
    setSavingDocumentId(documentType);
    setError("");
    try {
      const data = await updateMyDocumentFields(token, documentType, fields || {});
      patchDocument(documentType, data.document || {});
    } catch (err) {
      setError(err.message || "No se pudieron guardar los campos.");
    } finally {
      setSavingDocumentId(null);
    }
  }

  function buildApplication() {
    return {
      applicant: {
        fullName: applicant.fullName || user?.name || "",
        identification: applicant.identification || user?.rut || "",
        email: applicant.email || user?.email || "",
        phone: applicant.phone || "",
        monthlyIncome: applicant.monthlyIncome,
        employmentStatus: applicant.employmentStatus,
        currentDebtMonthly: applicant.currentDebtMonthly,
        noOfDependents: applicant.noOfDependents,
        employmentType: applicant.employmentType,
        laborStartMonth: applicant.laborStartMonth,
        laborStartYear: applicant.laborStartYear,
        laborSeniorityMonths: applicant.laborSeniorityMonths,
        loanPurpose: applicant.loanPurpose,
        additionalIncome: applicant.additionalIncome,
      },
      loan: {
        amount: simulation.amount,
        termMonths: simulation.termMonths,
        interestRate: simulation.interestRate,
        monthlyPayment: simulation.monthlyPayment,
        totalInterest: simulation.totalInterest,
        totalAmount: simulation.totalAmount,
      },
      documents: {
        identity: documentsByType.identity,
        salary: documentsByType.salary,
        afp_imponibles: documentsByType.afp_imponibles,
        cmf_debt: documentsByType.cmf_debt,
        social_registry: documentsByType.social_registry,
        financial_profile: documentsByType.financial_profile,
      },
      meta: {
        createdAt: new Date().toISOString(),
        source: "loan-application-page",
      },
    };
  }

  function handleContinue() {
    if (!isAuthenticated) {
      openLogin("login");
      return;
    }

    if (blockingRequirements.length > 0) {
      setError(`Completa antes de continuar: ${blockingRequirements.join(", ")}.`);
      return;
    }

    const application = buildApplication();
    try {
      localStorage.setItem(APPLICATION_DRAFT_KEY, JSON.stringify(application));
    } catch {}

    navigate("/identity-check", {
      state: { application },
    });
  }

  if (!simulation) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header onBack={() => navigate("/")} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">No hay una simulacion activa</h1>
            <p className="mt-3 text-slate-600">
              Vuelve al simulador, calcula un credito y luego presiona aplicar.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Volver al simulador
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header onBack={() => navigate("/")} />
        <main className="mx-auto max-w-3xl px-6 py-12 text-slate-600">
          Preparando solicitud...
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header onBack={() => navigate("/")} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Inicia sesion para continuar</h1>
            <p className="mt-3 text-slate-600">
              Guardamos temporalmente la simulacion para que puedas autenticarte
              y seguir con la solicitud sin perder los datos calculados.
            </p>
            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              Monto: <strong>{formatCurrency(simulation.amount)}</strong> | Plazo:{" "}
              <strong>{simulation.termMonths} meses</strong> | Cuota:{" "}
              <strong>{formatCurrency(simulation.monthlyPayment)}</strong>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openLogin("login")}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Iniciar sesion
              </button>
              <button
                type="button"
                onClick={() => openLogin("register")}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Crear cuenta
              </button>
            </div>
          </section>
        </main>
        <LoginModal />
      </div>
    );
  }

  const footerHint =
    blockingRequirements.length > 0
      ? `Pendiente: ${blockingRequirements.join(", ")}.`
      : "Documentos listos para continuar con validacion de identidad.";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header onBack={() => navigate("/")} onRefresh={loadDocuments} loading={loadingDocuments} />
      <main className="mx-auto max-w-[1780px] px-8 py-7">
        {blockingRequirements.length > 0 ? (
          <ApplicationRequirementNotice
            missingRequirements={blockingRequirements}
            onManageDocuments={() => navigate("/perfil/mis-documentos")}
          />
        ) : null}

        <DocumentReviewPanel
          summary={loanSummary}
          documents={documents}
          loading={loadingDocuments}
          error={error}
          uploadingDocumentId={uploadingDocumentId}
          savingDocumentId={savingDocumentId}
          onUploadDocument={handleUploadDocument}
          onFieldChange={handleFieldChange}
          onSaveFields={handleSaveFields}
          onBack={() => navigate("/")}
          onManageDocuments={() => navigate("/perfil/mis-documentos")}
          onContinue={handleContinue}
          continueDisabled={uploadingDocumentId !== null || savingDocumentId !== null || blockingRequirements.length > 0}
          continueLabel="Continuar a identidad"
          backLabel="Volver al simulador"
          manageDocumentsLabel="Ir a Mis Documentos"
          footerHint={footerHint}
        />
      </main>
      <LoginModal />
    </div>
  );
}

function ApplicationRequirementNotice({ missingRequirements, onManageDocuments }) {
  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-bold">Faltan documentos o datos para continuar</h2>
          <p className="mt-1 text-sm">
            Para avanzar a validacion de identidad debes completar:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {missingRequirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onManageDocuments}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
        >
          Ir a Mis Documentos
        </button>
      </div>
    </section>
  );
}

function Header({ onBack, onRefresh, loading = false }) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1780px] items-center justify-between px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Simulador
        </button>

        <div className="flex items-center gap-3 text-sm text-slate-700">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          ) : null}
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
            S
          </span>
          <span className="font-medium">Solicitud</span>
        </div>
      </div>
    </header>
  );
}
