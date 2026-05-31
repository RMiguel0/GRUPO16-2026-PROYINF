export function sanitizePostgresText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\u0000/g, '');
}

export function sanitizeExtractedText(value) {
  if (typeof value !== 'string') return '';

  return sanitizePostgresText(value)
    .replace(/\uFFFD/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasMeaningfulExtractedText(value) {
  const text = sanitizeExtractedText(value);
  const lettersOrNumbers = text.match(/[\p{L}\p{N}]/gu) || [];
  return lettersOrNumbers.length >= 8;
}

export function sanitizeJsonForPostgres(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    return sanitizePostgresText(value);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForPostgres(item, seen));
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      sanitizePostgresText(key),
      sanitizeJsonForPostgres(item, seen),
    ]),
  );
}

export function stringifyJsonForPostgres(value) {
  return JSON.stringify(sanitizeJsonForPostgres(value || {}));
}
