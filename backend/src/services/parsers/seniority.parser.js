import { normalizeText } from './parserUtils.js';

export function parseSeniority(rawText = '') {
  const text = normalizeText(rawText);

  const fields = {
    startDate: null,
  };

  const warnings = [];

  const labeledMatch = text.match(
    /(?:desde\s+el|fecha\s+de\s+inicio|inicio\s+de\s+labores)\s*:?\s*(\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+\s+de\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i
  );

  if (labeledMatch) {
    fields.startDate = labeledMatch[1];
  } else {
    const genericDate = text.match(
      /\b\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+\s+de\s+\d{4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/
    );

    if (genericDate) fields.startDate = genericDate[0];
  }

  if (!fields.startDate) {
    warnings.push('No se pudo detectar la fecha de inicio de labores');
  }

  return {
    documentType: 'seniority',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}
