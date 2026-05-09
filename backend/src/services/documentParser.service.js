import { parseIdentity } from './parsers/identity.parser.js';
import { parseAfpImponibles } from './parsers/afpImponibles.parser.js';
import { parseCmfDebt } from './parsers/cmf.parser.js';
import { parseSalary } from './parsers/salary.parser.js';
import { parseSeniority } from './parsers/seniority.parser.js';

export function analyzeDocument(text, documentType) {
  switch (documentType) {
    case 'identity':
      return parseIdentity(text);

    case 'afp_imponibles':
      return parseAfpImponibles(text);

    case 'cmf_debt':
      return parseCmfDebt(text);

    case 'salary':
      return parseSalary(text);

    case 'seniority':
      return parseSeniority(text);

    default:
      throw new Error(`Tipo de documento no soportado: ${documentType}`);
  }
}
