export const DOCUMENT_DEFINITIONS = [
  {
    id: "identity",
    title: "Cedula de Identidad",
    description: "Datos de identidad, RUT y vigencia",
    icon: "ID",
    requiredForApplication: true,
    expectedFields: ["rut", "fullName", "birthDate", "docNumber", "expiryDate"],
  },
  {
    id: "afp_imponibles",
    title: "Certificado AFP",
    description: "Remuneraciones imponibles y empleador",
    icon: "AFP",
    requiredForApplication: false,
    incomeDocument: true,
    expectedFields: [
      "employerRut",
      "employerName",
      "recentTaxableIncome",
      "averageTaxableIncome",
      "periodRange",
    ],
  },
  {
    id: "salary",
    title: "Liquidacion de Sueldo",
    description: "Sueldo liquido, descuentos y contrato",
    icon: "DOC",
    requiredForApplication: false,
    incomeDocument: true,
    expectedFields: [
      "baseSalary",
      "netSalary",
      "bonuses",
      "payrollDeductions",
      "contractType",
    ],
  },
  {
    id: "cmf_debt",
    title: "Informe de Deudas CMF",
    description: "Deuda directa, indirecta y lineas disponibles",
    icon: "CMF",
    requiredForApplication: true,
    expectedFields: [
      "directDebt",
      "indirectDebt",
      "availableCreditLines",
      "institutionsCount",
      "paymentStatus",
      "currentDebtMonthly",
    ],
  },
  {
    id: "seniority",
    title: "Certificado de Antiguedad",
    description: "Antiguedad y situacion laboral",
    icon: "LAB",
    requiredForApplication: false,
    expectedFields: [
      "employerName",
      "startDate",
      "seniorityMonths",
      "contractType",
    ],
  },
  {
    id: "financial_profile",
    title: "Perfil Financiero",
    description: "Dependientes, deuda mensual y situacion laboral",
    icon: "FIN",
    requiredForApplication: true,
    manual: true,
    expectedFields: [
      "monthlyIncome",
      "employmentStatus",
      "currentDebtMonthly",
      "noOfDependents",
      "loanPurpose",
      "additionalIncome",
    ],
  },
];

export const REQUIRED_FOR_APPLICATION = DOCUMENT_DEFINITIONS
  .filter((definition) => definition.requiredForApplication)
  .map((definition) => definition.id);

export const REQUIRED_ONE_OF = [
  DOCUMENT_DEFINITIONS
    .filter((definition) => definition.incomeDocument)
    .map((definition) => definition.id),
];

export const APPLICATION_READY_STATUSES = new Set([
  "processed",
  "manual_review",
  "warning",
]);
