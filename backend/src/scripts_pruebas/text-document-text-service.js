import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { parseGenericIdentityData } from '../services/parsers/genericIdentity.parser.js';

import { extractTextFromPdf } from '../services/ocrpdf.service.js';

dotenv.config();

async function main() {
  try {
    const filePath = path.resolve('src/scripts_pruebas/files/prueba.pdf');
    const fileBuffer = await fs.readFile(filePath);

    console.log('🚀 Extrayendo texto desde PDF...');

    const text = await extractTextFromPdf(fileBuffer, 'prueba.pdf');

    console.log('--- TEXTO ORIGINAL EXTRAIDO ---');
    console.log(text.slice(0, 1000));
    const parsedData = parseGenericIdentityData(text);

    console.log('✅ Datos parseados');
    console.log(JSON.stringify(parsedData, null, 2));

    console.log('✅ Texto extraído correctamente');
    console.log('-----------------------------');
    console.log(text.slice(0, 2000));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();