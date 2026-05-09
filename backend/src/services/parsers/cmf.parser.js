import {
  getLines,
  normalizeText,
  parseCurrency,
} from './parserUtils.js';

function getSection(text, startRegex, endRegex) {
  const start = text.search(startRegex);
  if (start < 0) return '';

  const afterStart = text.slice(start);
  const end = afterStart.search(endRegex);

  return end >= 0 ? afterStart.slice(0, end) : afterStart;
}

function parseTotalAmounts(sectionText) {
  const lines = getLines(sectionText);

  const totalLine = lines.find((line) => /^Total\b/i.test(line));
  if (!totalLine) return [];

  return [...totalLine.matchAll(/\$[\d.]+/g)]
    .map((match) => parseCurrency(match[0]))
    .filter((value) => value !== null);
}

function countInstitutions(sectionText) {
  const lines = getLines(sectionText);

  const dateCount = lines.filter((line) =>
    /\b\d{2}\/\d{2}\/\d{4}\b/.test(line)
  ).length;

  return dateCount;
}

function fallbackDirectDebt(text) {
  const match = text.match(/Deuda\s+Directa[\s\S]*?Total\s+(\$[\d.]+)/i);
  return match ? parseCurrency(match[1]) : null;
}

function fallbackIndirectDebt(text) {
  const match = text.match(/Deuda\s+Indirecta[\s\S]*?Total\s+(\$[\d.]+)/i);
  return match ? parseCurrency(match[1]) : null;
}

export function parseCmfDebt(rawText = '') {
  const text = normalizeText(rawText);

  const directSection = getSection(
    text,
    /Deuda\s+Directa/i,
    /Deuda\s+Indirecta/i
  );

  const indirectSection = getSection(
    text,
    /Deuda\s+Indirecta/i,
    /Cr[eé]ditos\s+disponibles/i
  );

  const creditLinesSection = getSection(
    text,
    /L[ií]neas\s+de\s+cr[eé]dito/i,
    /Otros\s+cr[eé]ditos/i
  );

  const directTotals = parseTotalAmounts(directSection);
  const indirectTotals = parseTotalAmounts(indirectSection);
  const creditLineTotals = parseTotalAmounts(creditLinesSection);

  const directDebt = directTotals[0] ?? fallbackDirectDebt(text);
  const indirectDebt = indirectTotals[0] ?? fallbackIndirectDebt(text);
  const availableCreditLines = creditLineTotals[0] ?? null;

  const overdue30 = directTotals[2] ?? 0;
  const overdue60 = directTotals[3] ?? 0;
  const overdue90 = directTotals[4] ?? 0;

  const fields = {
    directDebt,
    indirectDebt,
    availableCreditLines,
    institutionsCount: countInstitutions(directSection),
    paymentStatus:
      overdue30 > 0 || overdue60 > 0 || overdue90 > 0
        ? 'Con mora'
        : 'Al día',
  };

  const warnings = [];

  if (fields.directDebt === null) {
    warnings.push('No se pudo detectar la deuda directa');
  }

  if (fields.indirectDebt === null) {
    warnings.push('No se pudo detectar la deuda indirecta');
  }

  if (fields.availableCreditLines === null) {
    warnings.push('No se pudo detectar las líneas de crédito disponibles');
  }

  if (!fields.institutionsCount) {
    warnings.push('No se pudo contar la cantidad de instituciones acreedoras');
  }

  return {
    documentType: 'cmf_debt',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}