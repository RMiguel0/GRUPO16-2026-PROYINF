import {
  getLines,
  normalizeText,
  parseCurrency,
} from './parserUtils.js';

function escapeRegex(source) {
  return String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compact(text = '') {
  return normalizeText(text).replace(/\s+/g, ' ');
}

function findAmountAfterLabel(text, label, stopLabels = []) {
  const stopPattern = stopLabels.length > 0
    ? `(?=\\s+(?:${stopLabels.map(escapeRegex).join('|')})\\b|$)`
    : '';
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:?\\s*\\$?\\s*([\\d.]+)${stopPattern}`, 'i');
  const match = compact(text).match(pattern);
  return match ? parseCurrency(match[1]) : null;
}

function findAmountAfterLineLabel(lines, labelRegex, lookAhead = 2) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!labelRegex.test(lines[i])) continue;

    const sameLineText = lines[i].replace(labelRegex, '');
    const sameLineAmount = sameLineText.match(/\$?\s*\d{1,3}(?:\.\d{3})+/);
    if (sameLineAmount) return parseCurrency(sameLineAmount[0]);

    for (let j = i + 1; j <= Math.min(i + lookAhead, lines.length - 1); j += 1) {
      const amount = lines[j].match(/\$?\s*\d{1,3}(?:\.\d{3})+/);
      if (amount) return parseCurrency(amount[0]);
    }
  }

  return null;
}

function sumBonuses(text) {
  const matches = [
    ...compact(text).matchAll(
      /\b(?:Bono(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,4}|Comisi[oó]n(?:es)?|Horas(?:\s+Extra)?)\s+\$?\s*([\d.]+)/gi
    ),
  ];

  const amounts = matches
    .map((match) => parseCurrency(match[1]))
    .filter((value) => value !== null);

  return amounts.length > 0
    ? amounts.reduce((sum, value) => sum + value, 0)
    : null;
}

function findContractType(text) {
  const match = compact(text).match(
    /Tipo\s+de\s+Contrato\s*:\s*(.*?)(?=\s+(?:Cargo|AFP|ISAPRE|INFORMACI[OÓ]N\s+EMPRESA)\b|$)/i
  );

  return match?.[1]?.trim() || null;
}

export function parseSalary(rawText = '') {
  const text = normalizeText(rawText);
  const lines = getLines(text);

  const legalDeductions =
    findAmountAfterLabel(text, 'TOTAL DESC. LEGALES') ??
    findAmountAfterLineLabel(lines, /^TOTAL\s+DESC\.\s+LEGALES\b/i);
  const otherDeductions =
    findAmountAfterLabel(text, 'TOTAL OTROS DESC.') ??
    findAmountAfterLineLabel(lines, /^TOTAL\s+OTROS\s+DESC\./i);
  const baseSalary =
    findAmountAfterLabel(text, 'Sueldo Base') ??
    findAmountAfterLineLabel(lines, /^Sueldo\s+Base\b/i);
  const netSalary =
    findAmountAfterLabel(text, 'ALCANCE LÍQUIDO') ??
    findAmountAfterLabel(text, 'ALCANCE LIQUIDO') ??
    findAmountAfterLineLabel(lines, /^ALCANCE\s+L[IÍ]QUIDO\s*:/i);
  const bonuses = sumBonuses(text);
  const payrollDeductions =
    legalDeductions !== null || otherDeductions !== null
      ? (legalDeductions || 0) + (otherDeductions || 0)
      : null;
  const monthlyIncome =
    netSalary ??
    (
      baseSalary !== null || bonuses !== null || payrollDeductions !== null
        ? (baseSalary || 0) + (bonuses || 0) - (payrollDeductions || 0)
        : null
    );

  const fields = {
    monthlyIncome,
    baseSalary,
    netSalary,
    bonuses,
    payrollDeductions,
    contractType: findContractType(text),
  };

  const warnings = [];

  if (!fields.baseSalary) warnings.push('No se pudo detectar el sueldo base');
  if (!fields.netSalary) warnings.push('No se pudo detectar el sueldo liquido');
  if (!fields.monthlyIncome) warnings.push('No se pudo calcular el ingreso mensual');
  if (fields.bonuses === null) warnings.push('No se pudieron detectar bonos/comisiones');
  if (fields.payrollDeductions === null) warnings.push('No se pudieron detectar descuentos por planilla');
  if (!fields.contractType) warnings.push('No se pudo detectar el tipo de contrato');

  return {
    documentType: 'salary',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}
