import {
  normalizeText,
  getValueAfterLabel,
} from './parserUtils.js';

function parseIdentity(rawText = '') {
  const text = normalizeText(rawText);
  const lines = text.split('\n');

  const fields = {
    rut: null,
    fullName: null,
    birthDate: null,
    docNumber: null,
    expiryDate: null,
  };

  const warnings = [];

  const rutMatch = text.match(/(\d{1,2}\.\d{3}\.\d{3}-[0-9kK])|(\d{7,8}-[0-9kK])/);
  if (rutMatch) {
    fields.rut = rutMatch[0]
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .toUpperCase();
  }

  const ignoredNameWords = /(cedula|identidad|republica|chile|servicio|registro|civil|firma|sexo|nacionalidad|fecha|vencimiento|emision|documento|run|rut)/i;
  const nameLine = lines.find((line) => {
    const cleaned = line.trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    return words.length >= 2 && !/\d/.test(cleaned) && cleaned.length > 5 && !ignoredNameWords.test(cleaned);
  });

  if (nameLine) {
    fields.fullName = nameLine.replace(/\s{2,}/g, ' ').trim();
  }

  const birthDate = getValueAfterLabel(lines, /Fecha\s*(?:de)?\s*Nacimiento\s*:?\s*(.+)/i);
  if (birthDate) {
    fields.birthDate = birthDate;
  }

  const docNumber = getValueAfterLabel(
    lines,
    /(?:N(?:ú|u)mero|N°|Nº)\s*(?:de)?\s*(?:doc(?:umento)?|serie)?\s*:?\s*(.+)/i
  );
  if (docNumber) {
    fields.docNumber = docNumber;
  }

  let expiry = getValueAfterLabel(lines, /Fecha\s*(?:de)?\s*Vencimiento\s*:?\s*(.+)/i);
  if (!expiry) {
    expiry = getValueAfterLabel(lines, /V[aá]lida\s*hasta\s*:?\s*(.+)/i);
  }
  if (expiry) {
    fields.expiryDate = expiry;
  }

  if (!fields.rut) warnings.push('No se pudo detectar el RUT');
  if (!fields.fullName) warnings.push('No se pudo detectar el nombre completo');
  if (!fields.birthDate) warnings.push('No se pudo detectar la fecha de nacimiento');
  if (!fields.docNumber) warnings.push('No se pudo detectar el número de documento');
  if (!fields.expiryDate) warnings.push('No se pudo detectar la fecha de vencimiento');

  return {
    documentType: 'identity',
    fields,
    warnings,
    confidence: warnings.length === 0 ? 'high' : 'medium',
  };
}

export { parseIdentity };
