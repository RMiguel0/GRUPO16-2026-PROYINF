import {
  APPLICATION_READY_STATUSES,
  DOCUMENT_DEFINITIONS,
  REQUIRED_FOR_APPLICATION,
  REQUIRED_ONE_OF,
} from "./documentDefinitions.js";

function normalizeStatus(status, warnings = []) {
  if (!status || status === "pending") return "missing";
  if (status === "processed" && warnings.length > 0) return "warning";
  return status;
}

function normalizeStoredDocument(stored = {}, definition) {
  const warnings = Array.isArray(stored.warnings) ? stored.warnings : [];
  const errors = Array.isArray(stored.errors)
    ? stored.errors
    : stored.error
      ? [stored.error]
      : [];
  const status = normalizeStatus(stored.status, warnings);
  const storedFields = stored.fields && typeof stored.fields === "object" ? stored.fields : {};
  const expectedFields = Array.isArray(definition.expectedFields) ? definition.expectedFields : [];
  const emptyExpectedFields = Object.fromEntries(
    expectedFields.map((fieldName) => [fieldName, ""])
  );

  return {
    ...definition,
    ...stored,
    id: definition.id,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    required:
      Boolean(definition.requiredForApplication) ||
      Boolean(definition.incomeDocument),
    status,
    fields: {
      ...emptyExpectedFields,
      ...storedFields,
    },
    warnings,
    errors,
    source: stored.source || null,
    uploadedAt: stored.uploadedAt || null,
    processedAt: stored.processedAt || null,
    fileName: stored.fileName || null,
    rawText: stored.rawText || "",
    documentType: definition.id,
  };
}

export function mapDocumentsRowToPanelDocuments(documentsRow = {}) {
  return DOCUMENT_DEFINITIONS.map((definition) =>
    normalizeStoredDocument(documentsRow?.[definition.id] || {}, definition)
  );
}

function hasFieldValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim() !== "";
}

function hasExpectedFields(document) {
  const expectedFields = Array.isArray(document?.expectedFields) ? document.expectedFields : [];
  if (expectedFields.length === 0) return true;

  return expectedFields.every((fieldName) =>
    hasFieldValue(document?.fields?.[fieldName])
  );
}

export function isDocumentReadyForApplication(document) {
  return APPLICATION_READY_STATUSES.has(document?.status) && hasExpectedFields(document);
}

export function getMissingApplicationRequirements(documents) {
  const missing = [];
  const byId = Object.fromEntries((documents || []).map((document) => [document.id, document]));
  const employmentType = String(byId.financial_profile?.fields?.employmentType || "").toLowerCase();
  const incomeDocumentsRequired = employmentType !== "independiente";

  for (const documentType of REQUIRED_FOR_APPLICATION) {
    if (!isDocumentReadyForApplication(byId[documentType])) {
      const definition = DOCUMENT_DEFINITIONS.find((item) => item.id === documentType);
      missing.push(definition?.title || documentType);
    }
  }

  if (incomeDocumentsRequired) {
    for (const group of REQUIRED_ONE_OF) {
      if (!group.some((documentType) => isDocumentReadyForApplication(byId[documentType]))) {
        missing.push("Liquidacion de Sueldo o Certificado AFP");
      }
    }
  }

  return missing;
}

export function canContinueApplication(documents) {
  return getMissingApplicationRequirements(documents).length === 0;
}
