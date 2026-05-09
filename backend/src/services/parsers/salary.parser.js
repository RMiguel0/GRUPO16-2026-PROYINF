import {
  getLines,
  normalizeText,
  parseCurrency,
} from './parserUtils.js';

function findAmountAfterExactLabel(lines, labelRegex, lookAhead = 2) {
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

function sumBonusLines(lines) {
  let total = 0;
  let found = false;

  for (const line of lines) {
    if (!/^(Bono|Comisi[oó]n|Comisiones|Horas)\b/i.test(line.trim())) continue;

    const amount = line.match(/\$?\s*\d{1,3}(?:\.\d{3})+/);
    if (!amount) continue;

    const parsed = parseCurrency(amount[0]);
    if (parsed !== null) {
      total += parsed;
      found = true;
    }
  }

  return found ? total : null;
}

export function parseSalary(rawText = '') {
  const text = normalizeText(rawText);
  const lines = getLines(text);

  const legalDeductions = findAmountAfterExactLabel(lines, /^TOTAL\s+DESC\.\s+LEGALES\b/i);
  const otherDeductions = findAmountAfterExactLabel(lines, /^TOTAL\s+OTROS\s+DESC\./i);

  const contractMatch = text.match(/Tipo\s+de\s+Contrato\s*:\s*([^\n]+)/i);

  const fields = {
    baseSalary: findAmountAfterExactLabel(lines, /^Sueldo\s+Base\b/i),
    netSalary: findAmountAfterExactLabel(lines, /^ALCANCE\s+L[IÍ]QUIDO\s*:/i),
    bonuses: sumBonusLines(lines),
    payrollDeductions:
      legalDeductions !== null || otherDeductions !== null
        ? (legalDeductions || 0) + (otherDeductions || 0)
        : null,
    contractType: contractMatch?.[1]?.trim() || null,
  };

  const warnings = [];

  if (!fields.baseSalary) warnings.push('No se pudo detectar el sueldo base');
  if (!fields.netSalary) warnings.push('No se pudo detectar el sueldo líquido');
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
