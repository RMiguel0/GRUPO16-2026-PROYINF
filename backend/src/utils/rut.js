export function normalizeRut(rut) {
  const cleaned = String(rut || '')
    .trim()
    .replace(/[.\s-]/g, '')
    .toUpperCase();

  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  if (!/^\d{7,8}$/.test(body) || !/^[0-9K]$/.test(dv)) {
    return cleaned;
  }

  return `${body}-${dv}`;
}

export function isValidRut(rut) {
  const normalized = normalizeRut(rut);
  const match = /^(\d{7,8})-([0-9K])$/.exec(normalized);
  if (!match) return false;

  const [, body, dv] = match;
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  const expectedDv = result === 11 ? '0' : result === 10 ? 'K' : String(result);

  return expectedDv === dv;
}
