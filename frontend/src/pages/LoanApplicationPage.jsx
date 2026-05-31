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
import { formatCurrency } from "../utils/loanCalculations.js";

const PENDING_SIMULATION_KEY = "pendingLoanSimulation";
const APPLICATION_DRAFT_KEY = "loanApplicationDraft";

const DOCUMENT_DEFINITIONS = [
  {
    id: "identity",
    title: "Cedula de Identidad",
    description: "Datos de identidad, RUT y vigencia",
    icon: "ID",
  },
  {
    id: "afp_imponibles",
    title: "Certificado AFP",
    description: "Remuneraciones imponibles y empleador",
    icon: "AFP",
  },
  {
    id: "salary",
    title: "Liquidacion de Sueldo",
    description: "Sueldo liquido, descuentos y contrato",
    icon: "DOC",
  },
  {
    id: "cmf_debt",
    title: "Informe de Deudas CMF",
    description: "Deuda directa, indirecta y lineas disponibles",
    icon: "CMF",
  },
  {
    id: "financial_profile",
    title: "Perfil Financiero",
    description: "Dependientes, deuda mensual y situacion laboral",
    icon: "FIN",
  },
];

const REQUIRED_FOR_APPLICATION = ["identity", "cmf_debt", "financial_profile"];
const REQUIRED_ONE_OF = [["salary", "afp_imponibles"]];
const READY_STATUSES = new Set(["processed", "manual_review"]);

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

function normalizeDocumentPayload(payload = {}, definition) {
  const status = payload.status && payload.status !== "pending" ? payload.status : "missing";

  return {
    ...definition,
    ...payload,
    id: definition.id,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    required:
      REQUIRED_FOR_APPLICATION.includes(definition.id) ||
      REQUIRED_ONE_OF.some((group) => group.includes(definition.id)),
    status,
    fields: payload.fields && typeof payload.fields === "object" ? payload.fields : {},
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    errors: Array.isArray(payload.errors) ? payload.errors : [],
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

function isReady(document) {
  return READY_STATUSES.has(document?.status);
}

function resolveApplicant({ user, documentsByType }) {
  const identity = getFields(documentsByType.identity);
  const salary = getFields(documentsByType.salary);
  const afp = getFields(documentsByType.afp_imponibles);
  const debt = getFields(documentsByType.cmf_debt);
  const profile = getFields(documentsByType.financial_profile);

  const fullName =
    pickText(identity, ["fullName", "nombreCompleto"]) ||
    [pickText(identity, ["nombres"]), pickText(identity, ["apellidos"])].filter(Boolean).join(" ") ||
    user?.name ||
    "";

  const monthlyIncome =
    pickNumber(profile, ["monthlyIncome", "monthly_income", "incomeMonthly", "netMonthlyIncome"]) ??
    pickNumber(salary, ["netSalary", "baseSalary", "monthlyIncome", "averageMonthlyIncome"]) ??
    pickNumber(afp, ["averageTaxableIncome", "recentTaxableIncome", "monthlyIncome"]);

  const employmentStatus =
    pickText(profile, ["employmentStatus", "employment_status"]) ||
    pickText(salary, ["employmentStatus", "contractType"]) ||
    pickText(afp, ["employmentStatus"]) ||
    "employed";

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
    noOfDependents: pickNumber(profile, ["noOfDependents", "dependents", "cargasFamiliares"]),
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
    () =>
      DOCUMENT_DEFINITIONS.map((definition) =>
        normalizeDocumentPayload(documentsByType[definition.id] || {}, definition)
      ),
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

  const missingRequirements = useMemo(() => {
    const missing = [];
    const byId = Object.fromEntries(documents.map((document) => [document.id, document]));

    for (const documentType of REQUIRED_FOR_APPLICATION) {
      if (!isReady(byId[documentType])) {
        missing.push(DOCUMENT_DEFINITIONS.find((definition) => definition.id === documentType)?.title || documentType);
      }
    }

    for (const group of REQUIRED_ONE_OF) {
      if (!group.some((documentType) => isReady(byId[documentType]))) {
        missing.push("Liquidacion de Sueldo o Certificado AFP");
      }
    }

    if (!applicant.monthlyIncome || applicant.monthlyIncome <= 0) {
      missing.push("Ingreso mensual");
    }

    if (!applicant.employmentStatus) {
      missing.push("Situacion laboral");
    }

    return missing;
  }, [documents, applicant]);

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

    if (missingRequirements.length > 0) {
      setError(`Completa antes de continuar: ${missingRequirements.join(", ")}.`);
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
    missingRequirements.length > 0
      ? `Pendiente: ${missingRequirements.join(", ")}.`
      : "Documentos listos para continuar con validacion de identidad.";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header onBack={() => navigate("/")} onRefresh={loadDocuments} loading={loadingDocuments} />
      <main className="mx-auto max-w-[1780px] px-8 py-7">
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
          onContinue={handleContinue}
          continueDisabled={uploadingDocumentId !== null || savingDocumentId !== null || missingRequirements.length > 0}
          continueLabel="Continuar a identidad"
          backLabel="Volver al simulador"
          footerHint={footerHint}
        />
      </main>
      <LoginModal />
    </div>
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
