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
    id: "financial_profile",
    title: "Perfil Financiero",
    description: "Tipo laboral, destino e ingresos adicionales",
    icon: "FIN",
    requiredForApplication: true,
    manual: true,
    expectedFields: [
      "employmentType",
      "employmentStatus",
      "laborStartMonth",
      "laborStartYear",
      "laborSeniorityMonths",
      "loanPurpose",
      "additionalIncome",
    ],
  },
  {
    id: "social_registry",
    title: "Registro Social de Hogares",
    description: "Tramo socioeconomico, cargas y bienes",
    icon: "RSH",
    requiredForApplication: true,
    expectedFields: [
      "socioEconomicPercent",
      "householdDependents",
      "assetsCount",
    ],
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
      "monthlyIncome",
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
]);
