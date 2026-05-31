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

function extractPdfFromIlovePdfResult(resultBuffer) {
  try {
    const zip = new AdmZip(resultBuffer);
    const entries = zip.getEntries();

    const pdfEntry = entries.find((entry) =>
      entry.entryName.toLowerCase().endsWith('.pdf')
    );

    if (pdfEntry) {
      return pdfEntry.getData();
    }
  } catch {
    // Si no es ZIP, seguimos abajo y lo tratamos como PDF directo.
  }

  if (resultBuffer.subarray(0, 4).toString('utf8') === '%PDF') {
    return resultBuffer;
  }

  throw new Error('El resultado de iLovePDF no contiene un PDF convertido');
}

export async function convertImageToPdf(
  fileBuffer,
  filename = 'documento.jpg',
  mimeType = 'image/jpeg',
) {
  const token = await authenticateIlovePdf();
  const { server, task } = await startIlovePdfTask(token, 'imagepdf');

  const serverFilename = await uploadFileToIlovePdf(
    token,
    server,
    task,
    fileBuffer,
    filename,
    mimeType,
  );

  await processIlovePdfTask(token, server, task, 'imagepdf', [
    {
      server_filename: serverFilename,
      filename,
    },
  ], {
    orientation: 'portrait',
    margin: 0,
    pagesize: 'fit',
    merge_after: true,
  });

  const resultBuffer = await downloadIlovePdfResult(token, server, task);
  return extractPdfFromIlovePdfResult(resultBuffer);
}

export async function extractTextFromPdf(fileBuffer, filename = 'documento.pdf') {
  const token = await authenticateIlovePdf();

  const { server, task } = await startIlovePdfTask(token, 'extract');

  const serverFilename = await uploadFileToIlovePdf(
    token,
    server,
    task,
    fileBuffer,
    filename,
    'application/pdf',
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
