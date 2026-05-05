import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

import {
  authenticateIlovePdf,
  startIlovePdfTask,
  uploadFileToIlovePdf,
  processIlovePdfTask,
  downloadIlovePdfResult,
} from '../services/ocrpdf.service.js';

dotenv.config();

async function main() {
  try {
    console.log('🚀 TEST UPLOAD');

    const token = await authenticateIlovePdf();
    console.log('✅ Auth OK');

    const { server, task } = await startIlovePdfTask(token, 'extract');
    console.log('✅ Task OK');

    const filePath = path.resolve('src/scripts_pruebas/files/prueba.pdf');
    const fileBuffer = await fs.readFile(filePath);

    console.log('👉 Subiendo archivo...');
    const serverFilename = await uploadFileToIlovePdf(
      token,
      server,
      task,
      fileBuffer,
      'prueba.pdf'
    );

    console.log('✅ Upload OK');
    console.log('Server filename:', serverFilename);

    console.log('👉 Procesando extract...');

    await processIlovePdfTask(token, server, task, 'extract', [
    {
        server_filename: serverFilename,
        filename: 'prueba.pdf',
    },
    ]);

    console.log('✅ Process OK');
    console.log('👉 Descargando resultado...');

    const resultBuffer = await downloadIlovePdfResult(token, server, task);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.resolve(
    `src/scripts_pruebas/files/resultado_extract_${timestamp}.zip`
    );

    await fs.writeFile(outputPath, resultBuffer);

    console.log('✅ Download OK');
    console.log('Archivo generado:', outputPath);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();