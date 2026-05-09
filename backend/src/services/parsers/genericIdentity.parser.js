function normalizeText(text = '') {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/�/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function getCompactText(text) {
  return normalizeText(text).replace(/\s+/g, '');
}

function cleanLine(line = '') {
  return line
    .replace(/\u0000/g, '')
    .replace(/�/g, '')
    .replace(/[^\p{L}\p{N}@._%+\-/:\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmail(text) {
  const compact = getCompactText(text);
  const match = compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || null;
}

function extractPhone(text) {
  const compact = getCompactText(text);
  const match = compact.match(/(?:\+?56)?9\d{8}/);
  return match?.[0] || null;
}

function extractRut(text) {
  const compact = getCompactText(text).replace(/\./g, '');
  const match = compact.match(/\b\d{7,8}-?[0-9kK]\b/);
  if (!match) return null;

  const raw = match[0].toUpperCase();

  if (raw.includes('-')) return raw;

  return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
}

function extractBirthDate(text) {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/g, ' ');

  const labelMatch = compact.match(/Fecha\s*de\s*Nacimiento\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (labelMatch) return labelMatch[1];

  const allDates = compact.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g);
  return allDates?.[0] || null;
}

function fixSpacedName(line = '') {
  const cleaned = cleanLine(line);

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length < 4) return cleaned;

  const mostlyShortParts =
    parts.filter(part => part.length <= 2).length / parts.length >= 0.6;

  if (!mostlyShortParts) return cleaned;

  return parts.join('');
}

function extractNameFromFirstLines(text) {
  const lines = normalizeText(text)
    .split('\n')
    .map(cleanLine)
    .filter(line => line.length > 0);

  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase();

    if (/\d/.test(line)) continue;
    if (line.includes('@')) continue;
    if (lower.includes('ingenier')) continue;
    if (lower.includes('direccion')) continue;
    if (lower.includes('celular')) continue;
    if (lower.includes('mail')) continue;
    if (lower.includes('perfil')) continue;

    const fixed = fixSpacedName(line);

    if (fixed.length >= 8) {
      return fixed;
    }
  }

  return null;
}

export function parseGenericIdentityData(rawText = '') {
  const text = normalizeText(rawText);

  const fields = {
    fullName: extractNameFromFirstLines(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    rut: extractRut(text),
    birthDate: extractBirthDate(text),
  };

  const warnings = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!value) {
      warnings.push(`No se pudo detectar el campo: ${key}`);
    }
  }

  return {
    documentType: 'generic_identity',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}