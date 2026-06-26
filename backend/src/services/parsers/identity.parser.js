import {
  getLines,
  normalizeText,
} from './parserUtils.js';

const MONTHS = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  septiembre: 9,
  set: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

function cleanIdentityLine(line = '') {
  return String(line)
    .replace(/[^\p{L}\p{N}\-/.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForSearch(value = '') {
  return cleanIdentityLine(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeNameOcr(value = '') {
  return cleanIdentityLine(value)
    .replace(/\bCRDENAS\b/gi, 'CARDENAS')
    .replace(/\bC RDENAS\b/gi, 'CARDENAS')
    .replace(/\bCARDEN AS\b/gi, 'CARDENAS');
}

function valueAfterStandaloneLabel(lines, labels = []) {
  const normalizedLabels = labels.map(normalizeForSearch);

  for (let i = 0; i < lines.length; i += 1) {
    const current = normalizeForSearch(lines[i]);
    const label = normalizedLabels.find((item) => current === item || current.endsWith(item));
    if (!label) continue;

    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const candidate = cleanIdentityLine(lines[j]);
      if (candidate && !/\d/.test(candidate)) return candidate;
    }
  }

  return null;
}

function parseDateParts(value = '') {
  const numeric = String(value).match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numeric) {
    return {
      day: Number(numeric[1]),
      month: Number(numeric[2]),
      year: Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]),
    };
  }

  const named = cleanIdentityLine(value).match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i);
  if (!named) return null;

  const monthKey = named[2]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const month = MONTHS[monthKey];
  if (!month) return null;

  return { day: Number(named[1]), month, year: Number(named[3]) };
}

function extractDate(value = '') {
  const cleaned = cleanIdentityLine(value);
  const numeric = cleaned.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
  if (numeric) return numeric[0];

  const named = cleaned.match(/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/i);
  if (named && parseDateParts(named[0])) return named[0].toUpperCase();

  return null;
}

function isFutureDate(value = '') {
  const parts = parseDateParts(value);
  if (!parts) return false;

  const candidate = new Date(parts.year, parts.month - 1, parts.day).getTime();
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return candidate > current;
}

function isDateNearTodayOrPast(value = '') {
  const parts = parseDateParts(value);
  if (!parts) return false;
  return !isFutureDate(value);
}

function findDateNearLabel(lines, labelRegex, lookAhead = 4) {
  for (let i = 0; i < lines.length; i += 1) {
    const searchable = normalizeForSearch(lines[i]);
    if (!labelRegex.test(searchable)) continue;

    const sameLineDate = extractDate(lines[i]);
    if (sameLineDate) return sameLineDate;

    for (let j = i + 1; j <= Math.min(i + lookAhead, lines.length - 1); j += 1) {
      const date = extractDate(lines[j]);
      if (date) return date;
    }
  }

  return null;
}

function extractAllDates(lines) {
  const dates = [];
  for (const line of lines) {
    const date = extractDate(line);
    if (date && !dates.includes(date)) dates.push(date);
  }
  return dates;
}

function looksLikeDocumentNumber(candidate = '') {
  const cleaned = cleanIdentityLine(candidate)
    .replace(/\b(numero|num|nro|documento|serie|serial|RUN|RUT|fecha|nacimiento|vencimiento)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const searchable = normalizeForSearch(cleaned);

  if (
    !cleaned ||
    extractDate(cleaned) ||
    /(cedula|identidad|republica|chile|servicio|registro|civil|nacimiento|vencimiento|valida|firma)/.test(searchable)
  ) {
    return null;
  }

  const match = cleaned.match(/\b[A-Z0-9][A-Z0-9.\- ]{5,18}[A-Z0-9]\b/i);
  if (!match || !/\d/.test(match[0])) return null;

  const value = match[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (value.length < 6 || value.length > 18) return null;
  return value;
}

function findDocumentNumber(lines) {
  const labelRegex = /(numero|nro|num|documento|serie|serial)/;

  for (let i = 0; i < lines.length; i += 1) {
    if (!labelRegex.test(normalizeForSearch(lines[i]))) continue;

    const candidates = [lines[i], ...lines.slice(i + 1, Math.min(i + 5, lines.length))];
    for (const candidate of candidates) {
      const number = looksLikeDocumentNumber(candidate);
      if (number) return number;
    }
  }

  return null;
}

function findName(lines, currentFullName) {
  if (currentFullName) return currentFullName;

  const ignoredNameWords = /(cedula|identidad|republica|chile|servicio|registro|civil|firma|sexo|nacionalidad|fecha|vencimiento|emision|documento|run|rut|apellidos|apellido|nombres|nombre)/;
  const nameLine = lines.find((line) => {
    const cleaned = cleanIdentityLine(line);
    const searchable = normalizeForSearch(cleaned);
    const words = cleaned.split(/\s+/).filter(Boolean);
    return words.length >= 2 && !/\d/.test(cleaned) && cleaned.length > 5 && !ignoredNameWords.test(searchable);
  });

  return nameLine ? normalizeNameOcr(nameLine) : null;
}

export function parseIdentity(rawText = '') {
  const text = normalizeText(rawText);
  const lines = getLines(text);

  const fields = {
    rut: null,
    fullName: null,
    birthDate: null,
    docNumber: null,
    expiryDate: null,
  };

  const rutMatch = text.match(/(\d{1,2}\.\d{3}\.\d{3}-[0-9kK])|(\d{7,8}-[0-9kK])/);
  if (rutMatch) {
    fields.rut = rutMatch[0]
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .toUpperCase();
  }

  const surnames = valueAfterStandaloneLabel(lines, ['apellidos', 'apellido']);
  const names = valueAfterStandaloneLabel(lines, ['nombres', 'nombre']);
  if (names || surnames) {
    fields.fullName = normalizeNameOcr([names, surnames].filter(Boolean).join(' ').trim());
  }
  fields.fullName = findName(lines, fields.fullName);

  fields.birthDate = findDateNearLabel(lines, /(fecha.*nacimiento|nacimiento)/);
  fields.docNumber = findDocumentNumber(lines);
  fields.expiryDate = findDateNearLabel(lines, /(fecha.*vencimiento|vencimiento|valida.*hasta|vence)/);

  if (fields.birthDate && isFutureDate(fields.birthDate)) {
    fields.birthDate = null;
  }

  if (fields.birthDate && fields.expiryDate && fields.birthDate === fields.expiryDate) {
    fields.birthDate = null;
  }

  if (!fields.birthDate) {
    const fallbackBirthDate = extractAllDates(lines).find((date) =>
      date !== fields.expiryDate && isDateNearTodayOrPast(date)
    );
    if (fallbackBirthDate) fields.birthDate = fallbackBirthDate;
  }

  const warnings = [];
  if (!fields.rut) warnings.push('No se pudo detectar el RUT');
  if (!fields.fullName) warnings.push('No se pudo detectar el nombre completo');
  if (!fields.birthDate) warnings.push('No se pudo detectar la fecha de nacimiento');
  if (!fields.docNumber) warnings.push('No se pudo detectar el numero de documento');
  if (!fields.expiryDate) warnings.push('No se pudo detectar la fecha de vencimiento');

  return {
    documentType: 'identity',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}
