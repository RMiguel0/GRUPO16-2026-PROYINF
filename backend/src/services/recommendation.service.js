import { findLatestProcessedDocumentsForUser } from '../db/repositories/document.repository.js';

const DEFAULT_AMOUNT_MIN = Number(process.env.RECOMMENDATION_AMOUNT_MIN ?? 500000);
const DEFAULT_AMOUNT_STEP = Number(process.env.RECOMMENDATION_AMOUNT_STEP ?? 500000);
const DEFAULT_TERMS_MONTHS = (process.env.RECOMMENDATION_TERMS_MONTHS ?? '12,24,36,48,60')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const DEFAULT_ANNUAL_INTEREST_RATE = Number(process.env.RECOMMENDATION_ANNUAL_RATE ?? 0.055);
const DEFAULT_MAX_TOTAL_BURDEN = Number(process.env.RECOMMENDATION_MAX_TOTAL_BURDEN ?? 0.40);
const DEFAULT_MODEL_THRESHOLD = Number(process.env.RECOMMENDATION_MODEL_THRESHOLD ?? 0.55);
const DEFAULT_ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
const DEFAULT_MAX_INCOME_MULTIPLE = Number(process.env.RECOMMENDATION_MAX_INCOME_MULTIPLE ?? 1);
const DEBT_TOTAL_TO_MONTHLY_FACTOR = Number(process.env.RECOMMENDATION_DEBT_MONTHLY_FACTOR ?? 0.03);
const MISSING_FIELD_DOCUMENTS = {
  monthlyIncome: 'Liquidación de sueldo o certificado de remuneraciones imponibles.',
  currentDebtMonthly: 'Informe de deudas CMF.',
  noOfDependents: 'Cartola de Registro Social de Hogares .',
  employmentStatus: 'Certificado laboral o documento que acredite situación laboral actual.',
};

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNumberFromObject(source, keys) {
  if (!source || typeof source !== 'object') return null;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const parsed = asNumber(source[key]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isSelfEmployed(employmentStatus) {
  return ['independiente', 'self-employed', 'self employed', 'autonomo', 'autónomo', 'freelance', 'emprendedor']
    .includes(normalizeStatus(employmentStatus));
}

function amortizedPayment(principal, annualRate, termMonths) {
  if (annualRate <= 0) return principal / termMonths;

  const monthlyRate = annualRate / 12;
  return principal * (monthlyRate * (1 + monthlyRate) ** termMonths) / (((1 + monthlyRate) ** termMonths) - 1);
}

function generateAmounts(amountMin, amountMax, amountStep) {
  const amounts = [];
  for (let amount = amountMin; amount <= amountMax; amount += amountStep) {
    amounts.push(amount);
  }
  return amounts;
}

function getFields(document) {
  const data = document?.extracted_data || {};
  return data.fields && typeof data.fields === 'object' ? data.fields : data;
}

function firstDocumentOfType(documents, documentTypes) {
  return documents.find((document) => documentTypes.includes(document.document_type));
}

function extractFinancialProfile(documents) {
  const salaryDoc = firstDocumentOfType(documents, ['salary', 'liquidacion_sueldo', 'payroll']);
  const afpDoc = firstDocumentOfType(documents, ['afp_imponibles', 'afp']);
  const debtDoc = firstDocumentOfType(documents, ['cmf_debt', 'debt_report', 'debt']);
  const profileDoc = firstDocumentOfType(documents, ['financial_profile', 'profile', 'application_profile']);

  const salaryFields = getFields(salaryDoc);
  const afpFields = getFields(afpDoc);
  const debtFields = getFields(debtDoc);
  const profileFields = getFields(profileDoc);

  const explicitMonthlyIncome = pickNumberFromObject(profileFields, ['monthlyIncome', 'monthly_income', 'incomeMonthly', 'netMonthlyIncome']);
  const annualIncome = pickNumberFromObject(profileFields, ['annualIncome', 'income_annum', 'incomeAnnual']);
  const salaryIncome = pickNumberFromObject(salaryFields, ['netSalary', 'baseSalary', 'monthlyIncome', 'averageMonthlyIncome']);
  const afpIncome = pickNumberFromObject(afpFields, ['averageTaxableIncome', 'recentTaxableIncome', 'monthlyIncome']);

  const monthlyIncome = explicitMonthlyIncome || salaryIncome || afpIncome || (annualIncome ? annualIncome / 12 : null);

  const currentDebtMonthlyExplicit = pickNumberFromObject(
    { ...debtFields, ...profileFields },
    ['currentDebtMonthly', 'monthlyDebt', 'debtMonthly', 'monthlyPayment', 'estimatedMonthlyDebt'],
  );

  const totalDebt = pickNumberFromObject(
    debtFields,
    ['totalDebt', 'directDebt', 'debtTotal', 'currentDebtTotal'],
  );

  // TODO: reemplazar esta estimacion por una cuota mensual explicita cuando el OCR de deuda la entregue.
  const currentDebtMonthly = currentDebtMonthlyExplicit ?? (totalDebt !== null ? totalDebt * DEBT_TOTAL_TO_MONTHLY_FACTOR : null);

  const noOfDependents = pickNumberFromObject(
    { ...profileFields, ...salaryFields, ...afpFields },
    ['noOfDependents', 'no_of_dependents', 'dependents', 'cargasFamiliares'],
  );

  const employmentStatus =
    profileFields.employmentStatus ||
    profileFields.employment_status ||
    salaryFields.employmentStatus ||
    salaryFields.contractType ||
    afpFields.employmentStatus ||
    null;

  const missingFields = [];
  if (!monthlyIncome || monthlyIncome <= 0) missingFields.push('monthlyIncome');
  if (currentDebtMonthly === null || currentDebtMonthly < 0) missingFields.push('currentDebtMonthly');
  if (noOfDependents === null || noOfDependents < 0) missingFields.push('noOfDependents');
  if (!employmentStatus) missingFields.push('employmentStatus');

  return {
    values: {
      monthlyIncome,
      currentDebtMonthly,
      noOfDependents,
      employmentStatus,
    },
    missingFields,
    documentsUsed: [profileDoc, salaryDoc, afpDoc, debtDoc]
      .filter(Boolean)
      .map((document) => ({
        id: document.id,
        documentType: document.document_type,
        source: document.source,
        extractedAt: document.created_at,
      })),
  };
}

function buildScenario({ amount, termMonths, monthlyIncome, currentDebtMonthly, noOfDependents, employmentStatus, annualInterestRate }) {
  const incomeAnnum = monthlyIncome * 12;
  const loanTermYears = termMonths / 12;
  const estimatedMonthlyPayment = amount / loanTermYears;
  const monthlyPayment = amortizedPayment(amount, annualInterestRate, termMonths);
  const totalBurden = (currentDebtMonthly + monthlyPayment) / monthlyIncome;

  return {
    publicScenario: {
      amount,
      termMonths,
      monthlyPayment,
      paymentToIncome: monthlyPayment / monthlyIncome,
      totalBurden,
    },
    modelFeatures: {
      no_of_dependents: noOfDependents,
      self_employed: isSelfEmployed(employmentStatus) ? 1 : 0,
      income_annum: incomeAnnum,
      loan_amount: amount,
      loan_term: loanTermYears,
      loan_to_income: amount / incomeAnnum,
      monthly_income: incomeAnnum / 12,
      estimated_monthly_payment: estimatedMonthlyPayment,
      payment_to_income: estimatedMonthlyPayment / monthlyIncome,
    },
  };
}

async function predictScenarios(modelScenarios) {
  const response = await fetch(`${DEFAULT_ML_SERVICE_URL.replace(/\/$/, '')}/predict-scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarios: modelScenarios,
      threshold: DEFAULT_MODEL_THRESHOLD,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || 'No se pudo consultar el servicio ML.');
    error.status = 502;
    throw error;
  }

  return data.results || [];
}

function serializeScenario(scenario) {
  return {
    amount: Math.round(scenario.amount),
    termMonths: scenario.termMonths,
    approvalProbability: Number(scenario.approvalProbability.toFixed(6)),
    monthlyPayment: Math.round(scenario.monthlyPayment),
    paymentToIncome: Number(scenario.paymentToIncome.toFixed(6)),
    totalBurden: Number(scenario.totalBurden.toFixed(6)),
  };
}

function mapMissingFieldsToDocuments(missingFields) {
  return missingFields
    .map((field) => MISSING_FIELD_DOCUMENTS[field])
    .filter(Boolean);
}

export async function getLoanRecommendationForUser(user) {
  if (!user?.id) {
    const error = new Error('Debes iniciar sesion.');
    error.status = 401;
    throw error;
  }

  const documents = await findLatestProcessedDocumentsForUser(user.id);
  const financialProfile = extractFinancialProfile(documents);

  if (financialProfile.missingFields.length > 0) {
    const error = new Error('Informacion financiera insuficiente.');
    error.status = 422;
    error.code = 'INSUFFICIENT_FINANCIAL_DATA';
    error.reason = 'INSUFFICIENT_DOCUMENTS';
    error.missingDocuments = mapMissingFieldsToDocuments(financialProfile.missingFields);
    throw error;
  }

  const {
    monthlyIncome,
    currentDebtMonthly,
    noOfDependents,
    employmentStatus,
  } = financialProfile.values;

  const amountMin = DEFAULT_AMOUNT_MIN;
  const incomeBasedMax = Math.floor((monthlyIncome * 12 * DEFAULT_MAX_INCOME_MULTIPLE) / DEFAULT_AMOUNT_STEP) * DEFAULT_AMOUNT_STEP;
  const amountMax = Math.max(amountMin, incomeBasedMax);

  const allScenarios = [];
  const modelScenarios = [];
  const modelPublicScenarios = [];
  let discardedByDebtFilter = 0;

  for (const amount of generateAmounts(amountMin, amountMax, DEFAULT_AMOUNT_STEP)) {
    for (const termMonths of DEFAULT_TERMS_MONTHS) {
      const scenario = buildScenario({
        amount,
        termMonths,
        monthlyIncome,
        currentDebtMonthly,
        noOfDependents,
        employmentStatus,
        annualInterestRate: DEFAULT_ANNUAL_INTEREST_RATE,
      });

      allScenarios.push(scenario);

      if (scenario.publicScenario.totalBurden > DEFAULT_MAX_TOTAL_BURDEN) {
        discardedByDebtFilter += 1;
        continue;
      }

      modelScenarios.push(scenario.modelFeatures);
      modelPublicScenarios.push(scenario.publicScenario);
    }
  }

  const predictions = modelScenarios.length > 0 ? await predictScenarios(modelScenarios) : [];
  let discardedByModelThreshold = 0;
  const viableScenarios = [];

  predictions.forEach((prediction, index) => {
    const approvalProbability = Number(prediction.approvalProbability);
    if (!Number.isFinite(approvalProbability) || approvalProbability < DEFAULT_MODEL_THRESHOLD) {
      discardedByModelThreshold += 1;
      return;
    }

    viableScenarios.push({
      ...modelPublicScenarios[index],
      approvalProbability,
    });
  });

  viableScenarios.sort((a, b) => (
    b.amount - a.amount ||
    b.approvalProbability - a.approvalProbability ||
    a.totalBurden - b.totalBurden ||
    a.termMonths - b.termMonths
  ));

  const latestExtractionDate = financialProfile.documentsUsed
    .map((document) => document.extractedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    recommendation: viableScenarios[0] ? serializeScenario(viableScenarios[0]) : null,
    alternatives: viableScenarios.slice(1, 6).map(serializeScenario),
    discardedSummary: {
      totalScenarios: allScenarios.length,
      discardedByMissingData: 0,
      discardedByDebtFilter,
      discardedByModelThreshold,
    },
    sourceInfo: {
      usedLatestDocuments: true,
      extractedAt: latestExtractionDate,
      documentsUsed: financialProfile.documentsUsed,
    },
  };
}
