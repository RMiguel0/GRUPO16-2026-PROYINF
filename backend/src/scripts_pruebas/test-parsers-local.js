import fs from 'fs/promises';
import path from 'path';
import { analyzeDocument } from '../services/documentParser.service.js';

async function testParser(fileName, documentType) {
  const filePath = path.resolve('src/scripts_pruebas/textos', fileName);
  const text = await fs.readFile(filePath, 'utf8');

  const result = analyzeDocument(text, documentType);

  console.log('\n==============================');
  console.log(`Documento: ${documentType}`);
  console.log('==============================');
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  await testParser('imponiblesAFP.txt', 'afp_imponibles');
  await testParser('endeudamientoCMF.txt', 'cmf_debt');
  await testParser('liquidacion_sueldo.txt', 'salary');
  await testParser('certificado_antiguedad.txt', 'seniority');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
});