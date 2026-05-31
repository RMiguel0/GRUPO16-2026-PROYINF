export function sanitizePostgresText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\u0000/g, '');
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
