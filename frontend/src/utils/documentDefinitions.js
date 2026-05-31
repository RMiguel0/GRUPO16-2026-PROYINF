export const DOCUMENT_DEFINITIONS = [
  {
    id: "identity",
    title: "Cedula de Identidad",
    description: "Datos de identidad, RUT y vigencia",
    icon: "ID",
    requiredForApplication: true,
  },
  {
    id: "afp_imponibles",
    title: "Certificado AFP",
    description: "Remuneraciones imponibles y empleador",
    icon: "AFP",
    requiredForApplication: false,
    incomeDocument: true,
  },
  {
    id: "salary",
    title: "Liquidacion de Sueldo",
    description: "Sueldo liquido, descuentos y contrato",
    icon: "DOC",
    requiredForApplication: false,
    incomeDocument: true,
  },
  {
    id: "cmf_debt",
    title: "Informe de Deudas CMF",
    description: "Deuda directa, indirecta y lineas disponibles",
    icon: "CMF",
    requiredForApplication: true,
  },
  {
    id: "seniority",
    title: "Certificado de Antiguedad",
    description: "Antiguedad y situacion laboral",
    icon: "LAB",
    requiredForApplication: false,
  },
  {
    id: "financial_profile",
    title: "Perfil Financiero",
    description: "Dependientes, deuda mensual y situacion laboral",
    icon: "FIN",
    requiredForApplication: true,
    manual: true,
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
