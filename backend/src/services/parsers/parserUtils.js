// Helper utilities for parsing text extracted from OCR/PDF documents.
// ES Modules version for backend projects using "type": "module".

function normalizeText(text = '') {
  return String(text)
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/�/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function normalizeForSearch(text = '') {
  return normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseCurrency(value) {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!/^-?\d+$/.test(cleaned)) return null;

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function findFirstAmount(text = '') {
  const match = String(text).match(/\$?\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?|\$?\s*\d+/);
  return match ? parseCurrency(match[0]) : null;
}

function average(numbers = []) {
  const valid = numbers.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (valid.length === 0) return null;

  const sum = valid.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / valid.length);
}

function getLines(text = '') {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getValueAfterLabel(lines = [], labelRegex) {
  for (const line of lines) {
    const match = line.match(labelRegex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function getAmountNearLabel(lines = [], labelRegex, lookAhead = 2) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!labelRegex.test(lines[i])) continue;

    for (let j = i; j <= Math.min(i + lookAhead, lines.length - 1); j += 1) {
      const amount = findFirstAmount(lines[j]);
      if (amount !== null) return amount;
    }
  }

  return null;
}

function uniqueCount(values = []) {
  return new Set(values.filter(Boolean).map((v) => String(v).trim())).size;
}

export {
  normalizeText,
  normalizeForSearch,
  parseCurrency,
  findFirstAmount,
  average,
  getLines,
  getValueAfterLabel,
  getAmountNearLabel,
  uniqueCount,
};
