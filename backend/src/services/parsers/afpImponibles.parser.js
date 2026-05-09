import {
  normalizeText,
  parseCurrency,
  average,
} from './parserUtils.js';

function cleanEmployerName(name = '') {
  return name
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b[A-E]\b\s*$/i, '')
    .trim();
}

function parseAfpRows(text) {
  const normalized = normalizeText(text);
  const rows = [];

  const tableStart = normalized.search(/01-\d{4}|12-\d{4}|11-\d{4}/);
  const tableEnd = normalized.search(/Tipos\s+de\s+Fondos/i);

  const tableText =
    tableStart >= 0
      ? normalized.slice(tableStart, tableEnd > tableStart ? tableEnd : undefined)
      : normalized;

  const rowRegex =
    /(\d{2}-\d{4})\s+([\d.]+)\s+(\d{1,2}\.\d{3}\.\d{3}-[0-9kK])\s+([\s\S]*?)(?=\n\d{2}-\d{4}\s+[\d.]|\nTipos\s+de\s+Fondos|$)/gi;

  let match;
  while ((match = rowRegex.exec(tableText)) !== null) {
    const [, period, taxableIncome, employerRut, rawEmployerName] = match;

    rows.push({
      period,
      taxableIncome: parseCurrency(taxableIncome),
      employerRut: employerRut.replace(/\s+/g, '').toUpperCase(),
      employerName: cleanEmployerName(rawEmployerName),
    });
  }

  return rows;
}

function mostFrequent(values = []) {
  const counts = new Map();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function parseAfpImponibles(rawText = '') {
  const text = normalizeText(rawText);
  const rows = parseAfpRows(text);

  const rangeMatch = text.match(
    /per[ií]odo\s+comprendido\s+entre\s+(\d{2}\/\d{4})\s+y\s+(\d{2}\/\d{4})/i
  );

  const fields = {
    employerRut: mostFrequent(rows.map((row) => row.employerRut)),
    employerName: mostFrequent(rows.map((row) => row.employerName)),
    recentTaxableIncome: rows.find((row) => row.taxableIncome !== null)?.taxableIncome || null,
    averageTaxableIncome: average(rows.map((row) => row.taxableIncome)),
    periodRange: rangeMatch ? `${rangeMatch[1]} - ${rangeMatch[2]}` : null,
  };

  const warnings = [];

  if (!fields.employerRut) warnings.push('No se pudo detectar el RUT del empleador');
  if (!fields.employerName) warnings.push('No se pudo detectar el nombre del empleador');
  if (!fields.recentTaxableIncome) warnings.push('No se pudo detectar la renta imponible reciente');
  if (!fields.averageTaxableIncome) warnings.push('No se pudo calcular el promedio de renta imponible');
  if (!fields.periodRange) warnings.push('No se pudo detectar el rango de periodos');

  return {
    documentType: 'afp_imponibles',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
    meta: {
      rowsDetected: rows.length,
    },
  };
}
