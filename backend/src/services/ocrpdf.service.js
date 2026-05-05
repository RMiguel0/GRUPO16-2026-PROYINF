import AdmZip from 'adm-zip';

import {
  authenticateIlovePdf,
  startIlovePdfTask,
  uploadFileToIlovePdf,
  processIlovePdfTask,
  downloadIlovePdfResult,
} from './ilovePdfClient.js';

function extractTextFromZip(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const textEntry = entries.find((entry) =>
    entry.entryName.toLowerCase().endsWith('.txt')
  );

  if (!textEntry) {
    throw new Error('El resultado de iLovePDF no contiene un archivo .txt');
  }

  return textEntry.getData().toString('utf8');
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

  const extractedText = extractTextFromZip(resultBuffer);

  return extractedText;
}