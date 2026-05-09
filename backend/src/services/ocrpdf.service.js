import AdmZip from 'adm-zip';

import {
  authenticateIlovePdf,
  startIlovePdfTask,
  uploadFileToIlovePdf,
  processIlovePdfTask,
  downloadIlovePdfResult,
} from './ilovePdfClient.js';

function extractTextFromIlovePdfResult(resultBuffer) {
  try {
    const zip = new AdmZip(resultBuffer);
    const entries = zip.getEntries();

    const textEntry = entries.find((entry) =>
      entry.entryName.toLowerCase().endsWith('.txt')
    );

    if (textEntry) {
      return textEntry.getData().toString('utf8');
    }
  } catch {
    // Si no es ZIP, seguimos abajo y lo tratamos como texto plano.
  }

  const text = resultBuffer.toString('utf8').trim();

  if (!text) {
    throw new Error('El resultado de iLovePDF no contiene texto extraíble');
  }

  return text;
}

export async function extractTextFromPdf(fileBuffer, filename = 'documento.pdf') {
  const token = await authenticateIlovePdf();

  const { server, task } = await startIlovePdfTask(token, 'extract');

  const serverFilename = await uploadFileToIlovePdf(
    token,
    server,
    task,
    fileBuffer,
    filename
  );

  await processIlovePdfTask(token, server, task, 'extract', [
    {
      server_filename: serverFilename,
      filename,
    },
  ]);

  const resultBuffer = await downloadIlovePdfResult(token, server, task);

  const extractedText = extractTextFromIlovePdfResult(resultBuffer);
  
  return extractedText;
}