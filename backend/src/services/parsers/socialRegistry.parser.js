import {
  getLines,
  normalizeForSearch,
  normalizeText,
} from './parserUtils.js';

function asInteger(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asPercent(value) {
  const parsed = asInteger(value);
  if (parsed === null || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function findNumberNearLabel(lines, labelRegex, lookAhead = 3) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!labelRegex.test(normalizeForSearch(lines[i]))) continue;

    for (let j = i; j <= Math.min(i + lookAhead, lines.length - 1); j += 1) {
      const match = lines[j].match(/\b\d{1,3}\b/);
      if (match) return asInteger(match[0]);
    }
  }

  return null;
}

function findSocioEconomicPercent(text, searchableText, lines) {
  const rangeMatch = text.match(/(\d{1,3})\s*a\s*(\d{1,3})\s*%/i);
  const rangeStart = asPercent(rangeMatch?.[1]);
  if (rangeStart !== null) return rangeStart;

  const patterns = [
    /(?:tramo|calificacion|clasificacion|porcentaje)[^\n%]{0,120}?(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%[^\n]{0,80}(?:menores ingresos|mas vulnerable|vulnerabilidad|socioeconomico|socioeconomica)/i,
    /registro social de hogares[^\n%]{0,200}?(\d{1,3})\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const percent = asPercent(match?.[1]);
    if (percent !== null) return percent;
  }

  const nearLabel = findNumberNearLabel(
    lines,
    /(tramo|calificacion|clasificacion|porcentaje).*(socioeconomico|socioeconomica|hogares|rsh)/,
  );

  return asPercent(nearLabel);
}

function findHouseholdDependents(searchableText, lines) {
  const preferredPatterns = [
    /total\s+de\s+integrantes\s*:?\s*(\d{1,2})\s+personas/i,
    /personas\s+que\s+conforman\s+el\s+hogar\s*:?\s*total\s+(\d{1,2})/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = searchableText.match(pattern);
    const value = asInteger(match?.[1]);
    if (value !== null) return value;
  }

  const patterns = [
    /(?:personas|integrantes|miembros|cargas)[^\n]{0,80}(?:hogar|domicilio)[^\n]{0,40}?(\d{1,2})/i,
    /(?:hogar|domicilio)[^\n]{0,80}(?:personas|integrantes|miembros|cargas)[^\n]{0,40}?(\d{1,2})/i,
    /(?:numero|cantidad|n)\s*(?:de)?\s*(?:personas|integrantes|cargas)[^\n]{0,80}?(\d{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = searchableText.match(pattern);
    const value = asInteger(match?.[1]);
    if (value !== null) return value;
  }

  return findNumberNearLabel(lines, /(personas|integrantes|miembros|cargas).*(hogar|domicilio)/);
}

function findAssetsCount(searchableText, lines) {
  const patterns = [
    /(?:cantidad|numero|n)\s*(?:de)?\s*(?:bienes|activos|vehiculos|propiedades)[^\n]{0,80}?(\d{1,3})/i,
    /(?:bienes|activos|vehiculos|propiedades)[^\n]{0,80}(?:registrados|informados|declarados)?[^\n]{0,40}?(\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = searchableText.match(pattern);
    const value = asInteger(match?.[1]);
    if (value !== null) return value;
  }

  const assetFactors = [
    /bienes\s+raices|propiedades|inmuebles/i,
    /vehiculos/i,
  ];
  const inferredCount = assetFactors.filter((pattern) => pattern.test(searchableText)).length;
  if (inferredCount > 0) return inferredCount;

  return findNumberNearLabel(lines, /(bienes|activos|vehiculos|propiedades)/);
}

export function parseSocialRegistry(rawText = '') {
  const text = normalizeText(rawText);
  const searchableText = normalizeForSearch(text);
  const lines = getLines(text);

  const fields = {
    socioEconomicPercent: findSocioEconomicPercent(text, searchableText, lines),
    householdDependents: findHouseholdDependents(searchableText, lines),
    assetsCount: findAssetsCount(searchableText, lines),
  };

  const warnings = [];
  if (fields.socioEconomicPercent === null) {
    warnings.push('No se pudo detectar el porcentaje de nivel socioeconomico');
  }
  if (fields.householdDependents === null) {
    warnings.push('No se pudo detectar la cantidad de personas que son carga en el domicilio');
  }
  if (fields.assetsCount === null) {
    warnings.push('No se pudo detectar la cantidad de bienes');
  }

  return {
    documentType: 'social_registry',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}
