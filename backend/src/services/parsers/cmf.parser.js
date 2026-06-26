import {
  getLines,
  normalizeText,
  parseCurrency,
} from './parserUtils.js';

const DEBT_MONTHLY_FACTOR = Number(process.env.CMF_DEBT_MONTHLY_FACTOR ?? 0.03);

function flat(text = '') {
  return normalizeText(text).replace(/\s+/g, ' ');
}

function getSection(text, startRegex, endRegex) {
  const normalized = flat(text);
  const start = normalized.search(startRegex);
  if (start < 0) return '';

  const afterStart = normalized.slice(start);
  const end = afterStart.search(endRegex);

  return end >= 0 ? afterStart.slice(0, end) : afterStart;
}

function parseTotalRow(sectionText) {
  const matches = [...sectionText.matchAll(/Total\s+(\$[\d.]+)\s+(\$[\d.]+)\s+(\$[\d.]+)\s+(\$[\d.]+)\s+(\$[\d.]+)/gi)];
  const last = matches.at(-1);
  if (!last) return [];

  return last
    .slice(1)
    .map((value) => parseCurrency(value))
    .filter((value) => value !== null);
}

function countInstitutions(sectionText) {
  const lines = getLines(sectionText);
  const fromDates = lines.filter((line) => /\b\d{2}\/\d{2}\/\d{4}\b/.test(line)).length;
  if (fromDates > 0) return fromDates;

  return [...sectionText.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)].length;
}

function fallbackDirectDebt(text) {
  const match = flat(text).match(/Deuda\s+Directa[\s\S]*?Total\s+(\$[\d.]+)/i);
  return match ? parseCurrency(match[1]) : null;
}

function fallbackIndirectDebt(text) {
  const match = flat(text).match(/Deuda\s+Indirecta[\s\S]*?Total\s+(\$[\d.]+)/i);
  return match ? parseCurrency(match[1]) : null;
}

function parseAvailableCreditLines(text) {
  const normalized = flat(text);
  const sectionMatch = normalized.match(
    /L\S*neas\s+de\s+cr\S*dito([\s\S]*?)(?=\s+Otros\s+cr\S*ditos|\s+\(Nota|$)/i
  );
  const section = sectionMatch?.[1] || '';
  const match = section.match(/Total\s+(\$[\d.]+)\s+\$[\d.]+/i);

  if (match) return parseCurrency(match[1]);

  const noInfoMatch = normalized.match(
    /Cr\S*ditos\s+disponibles[\s\S]*?L\S*neas\s+de\s+cr\S*dito[\s\S]*?No\s+registra/i
  );

  return noInfoMatch ? 0 : null;
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

  const directTotals = parseTotalRow(directSection);
  const indirectTotals = parseTotalRow(indirectSection);

  const directDebt = directTotals[0] ?? fallbackDirectDebt(text);
  const indirectDebt = indirectTotals[0] ?? fallbackIndirectDebt(text);
  const availableCreditLines = parseAvailableCreditLines(text);

  const overdue30 = directTotals[2] ?? 0;
  const overdue60 = directTotals[3] ?? 0;
  const overdue90 = directTotals[4] ?? 0;
  const currentDebtMonthly =
    directDebt !== null || indirectDebt !== null
      ? Math.round(((directDebt || 0) + (indirectDebt || 0)) * DEBT_MONTHLY_FACTOR)
      : null;

  const fields = {
    directDebt,
    indirectDebt,
    availableCreditLines,
    institutionsCount: countInstitutions(directSection),
    paymentStatus:
      overdue30 > 0 || overdue60 > 0 || overdue90 > 0
        ? 'Con mora'
        : 'Al dia',
    currentDebtMonthly,
  };

  const warnings = [];

  if (fields.directDebt === null) {
    warnings.push('No se pudo detectar la deuda directa');
  }

  if (fields.indirectDebt === null) {
    warnings.push('No se pudo detectar la deuda indirecta');
  }

  if (fields.availableCreditLines === null) {
    warnings.push('No se pudo detectar las lineas de credito disponibles');
  }

  if (!fields.institutionsCount) {
    warnings.push('No se pudo contar la cantidad de instituciones acreedoras');
  }

  if (fields.currentDebtMonthly === null) {
    warnings.push('No se pudo estimar la deuda mensual actual');
  }

  return {
    documentType: 'cmf_debt',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}
