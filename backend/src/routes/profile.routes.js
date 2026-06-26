import { Router } from 'express';
import multer from 'multer';
import auth from '../middlewares/auth.js';
import { saveProcessedDocument } from '../db/repositories/document.repository.js';
import { findCreditsByUserId } from '../db/repositories/credits.repository.js';
import {
  DOCUMENT_COLUMNS,
  findDocumentsByUserId,
  updateDocumentSlot,
} from '../db/repositories/documents.repository.js';
import { getLoanRecommendationForUser } from '../services/recommendation.service.js';
import {
  extractTextFromPdfWithOcr,
  convertImageToPdf,
  extractTextFromPdf,
} from '../services/ocrpdf.service.js';
import { analyzeDocument } from '../services/documentParser.service.js';
import {
  hasMeaningfulExtractedText,
  sanitizeExtractedText,
} from '../utils/postgresJson.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const REQUIRED_DOCUMENTS = ['identity', 'financial_profile', 'social_registry', 'afp_imponibles', 'salary', 'cmf_debt'];
const APPLICATION_REQUIRED_DOCUMENTS = ['identity', 'cmf_debt', 'financial_profile', 'social_registry'];
const APPLICATION_REQUIRED_ONE_OF = [['salary', 'afp_imponibles']];
const CREDIT_STATUS_LABELS = {
  0: 'Procesando',
  1: 'Vigente',
  2: 'Rechazado',
};

function requireUserRut(req, res) {
  if (!req.user?.rut) {
    res.status(409).json({
      error: 'MISSING_USER_RUT',
      message: 'Debes tener un RUT asociado a tu cuenta para usar documentos.',
    });
    return null;
  }

  return req.user.rut;
}

function requireDocumentOwner(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Debes iniciar sesion.' });
    return null;
  }

  const rut = requireUserRut(req, res);
  if (!rut) return null;

  return { userId, rut };
}

function isAllowedDocumentType(documentType) {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_COLUMNS, documentType);
}

function emptyDocumentPayload(documentType) {
  return {
    status: 'missing',
    source: null,
    uploadedAt: null,
    processedAt: null,
    fileName: null,
    mimeType: null,
    fields: {},
    warnings: [],
    errors: [],
    rawText: '',
    documentType,
  };
}

function normalizeDocumentsRow(row) {
  const documents = {};

  for (const documentType of Object.keys(DOCUMENT_COLUMNS)) {
    const stored = row?.[documentType] || {};
    documents[documentType] = {
      ...emptyDocumentPayload(documentType),
      ...stored,
      fields: stored.fields && typeof stored.fields === 'object' ? stored.fields : {},
      warnings: Array.isArray(stored.warnings) ? stored.warnings : [],
      errors: Array.isArray(stored.errors) ? stored.errors : [],
      documentType,
    };
  }

  return documents;
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCreditRow(row) {
  const status = Number(row.status);
  return {
    id: row.id,
    product: row.product,
    status,
    statusLabel: CREDIT_STATUS_LABELS[status] || 'Procesando',
    amount: numberOrNull(row.amount),
    termMonths: numberOrNull(row.term_months),
    interestRateMonthly: numberOrNull(row.interest_rate_monthly),
    interestRateAnnual: numberOrNull(row.interest_rate_annual),
    monthlyPayment: numberOrNull(row.monthly_payment),
    totalPayment: numberOrNull(row.total_payment),
    totalInterest: numberOrNull(row.total_interest),
    score: numberOrNull(row.score),
    risk: row.risk,
    rejectionReason: row.rejection_reason,
    sourceApplicationId: row.source_application_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
  };
}

function parseExtractedText(rawText, documentType) {
  if (documentType === 'financial_profile') {
    return {
      documentType,
      fields: {},
      warnings: ['Perfil financiero cargado. Completa los campos manualmente si corresponde.'],
      confidence: 'low',
    };
  }

  return analyzeDocument(rawText, documentType);
}

function normalizeManualProfileFields(fields = {}) {
  const laborSeniorityMonths = calculateLaborSeniorityMonths(
    fields.laborStartMonth,
    fields.laborStartYear,
  );

  return {
    employmentType: fields.employmentType || '',
    employmentStatus: fields.employmentStatus || '',
    laborStartMonth: fields.laborStartMonth || '',
    laborStartYear: fields.laborStartYear || '',
    laborSeniorityMonths: laborSeniorityMonths ?? fields.laborSeniorityMonths ?? '',
    loanPurpose: fields.loanPurpose || '',
    additionalIncome: fields.additionalIncome || '',
  };
}

function calculateLaborSeniorityMonths(monthValue, yearValue) {
  const month = Number(monthValue);
  const year = Number(yearValue);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return null;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return String(Math.max(0, (currentYear - year) * 12 + (currentMonth - month)));
}

async function saveProcessedDocumentSnapshot({ userId, documentType, payload }) {
  if (!userId) return;

  await saveProcessedDocument({
    userId,
    documentType,
    rawText: payload.rawText || null,
    extractedData: {
      documentType,
      fields: payload.fields || {},
      warnings: payload.warnings || [],
      confidence: payload.confidence || null,
    },
    source: payload.source || null,
  });
}

function buildExtractionDebug(originalText, cleanedText, meta = {}) {
  const original = typeof originalText === 'string' ? originalText : '';
  const cleaned = typeof cleanedText === 'string' ? cleanedText : '';
  const originalPreview = original.slice(0, 3000);
  const cleanedPreview = cleaned.slice(0, 3000);

  return {
    originalLength: original.length,
    cleanedLength: cleaned.length,
    originalPreview,
    cleanedPreview,
    originalFirstCharCodes: Array.from(originalPreview.slice(0, 80)).map((char) =>
      char.codePointAt(0)
    ),
    cleanedFirstCharCodes: Array.from(cleanedPreview.slice(0, 80)).map((char) =>
      char.codePointAt(0)
    ),
    meaningful: hasMeaningfulExtractedText(cleaned),
    ...meta,
  };
}

function isSupportedIdentityImage(mimetype) {
  return ['image/jpeg', 'image/jpg'].includes(String(mimetype || '').toLowerCase());
}

function isSupportedUpload(documentType, mimetype) {
  if (mimetype === 'application/pdf') return true;
  return documentType === 'identity' && isSupportedIdentityImage(mimetype);
}

function pdfFilenameForImage(filename = 'documento.jpg') {
  return filename.replace(/\.(jpe?g)$/i, '.pdf') || 'documento.pdf';
}

function documentProcessingMessage(error) {
  const message = String(error?.message || '');
  if (/401|unauthorized|signature verification failed/i.test(message)) {
    return 'No se pudo validar la conexion con iLovePDF. Intenta subir el documento nuevamente; si se repite, revisa las credenciales de iLovePDF.';
  }

  return message || 'No se pudo procesar el documento.';
}

async function handleDocumentUpload(req, res, next) {
  const owner = requireDocumentOwner(req, res);
  if (!owner) return;

  const { documentType } = req.params;
  if (!isAllowedDocumentType(documentType)) {
    return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'MISSING_FILE' });
  }

  if (!isSupportedUpload(documentType, req.file.mimetype)) {
    return res.status(415).json({
      error: 'UNSUPPORTED_FILE_TYPE',
      message: documentType === 'identity'
        ? 'La cedula de identidad puede cargarse como PDF o JPG.'
        : 'Por ahora este tipo de documento solo acepta PDF.',
    });
  }

  const uploadedAt = new Date().toISOString();

  try {
    const isIdentityImage = documentType === 'identity' && isSupportedIdentityImage(req.file.mimetype);
    const pdfBuffer = isIdentityImage
      ? await convertImageToPdf(req.file.buffer, req.file.originalname, req.file.mimetype)
      : req.file.buffer;
    const pdfFilename = isIdentityImage
      ? pdfFilenameForImage(req.file.originalname)
      : req.file.originalname;
    const shouldForceOcr = isIdentityImage;
    let extractError = null;
    let iloveRawText = '';
    if (shouldForceOcr) {
      iloveRawText = await extractTextFromPdfWithOcr(pdfBuffer, pdfFilename);
    } else {
      try {
        iloveRawText = await extractTextFromPdf(pdfBuffer, pdfFilename);
      } catch (err) {
        extractError = err;
      }
    }
    let rawText = sanitizeExtractedText(iloveRawText);
    let originalRawText = iloveRawText;
    let extractionSource = shouldForceOcr ? 'ilovepdf_imagepdf_pdfocr_extract' : 'ilovepdf';
    let usedOcrFallback = shouldForceOcr;

    if (!shouldForceOcr && !hasMeaningfulExtractedText(rawText)) {
      try {
        iloveRawText = await extractTextFromPdfWithOcr(pdfBuffer, pdfFilename);
      } catch (err) {
        throw extractError || err;
      }
      rawText = sanitizeExtractedText(iloveRawText);
      originalRawText = iloveRawText;
      extractionSource = 'ilovepdf_pdfocr_extract';
      usedOcrFallback = true;
    }

    const debugExtraction = buildExtractionDebug(originalRawText, rawText, {
      sourceUsed: extractionSource,
      inputMimeType: req.file.mimetype,
      convertedToPdf: isIdentityImage,
      usedOcr: usedOcrFallback,
      ocrLanguages: usedOcrFallback ? ['spa', 'eng'] : null,
      initialExtractError: extractError?.message || null,
      convertedPdfFilename: isIdentityImage ? pdfFilename : null,
      imageToPdfOptions: isIdentityImage
        ? {
            orientation: 'portrait',
            margin: 0,
            pagesize: 'fit',
            merge_after: true,
          }
        : null,
      ilovePdfPreview: iloveRawText.slice(0, 3000),
      ilovePdfFirstCharCodes: Array.from(iloveRawText.slice(0, 80)).map((char) =>
        char.codePointAt(0)
      ),
    });

    const parsed = hasMeaningfulExtractedText(rawText)
      ? parseExtractedText(rawText, documentType)
      : {
          documentType,
          fields: {},
          warnings: [
            isIdentityImage
              ? 'La imagen JPG fue convertida a PDF con iLovePDF, pero no se pudo extraer texto legible desde el PDF resultante.'
              : 'No se pudo extraer texto legible del PDF con iLovePDF extract. El archivo parece ser una imagen escaneada dentro de un PDF, sin capa de texto seleccionable.',
          ],
          confidence: 'low',
        };
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const processedAt = new Date().toISOString();

    const payload = {
      status: warnings.length > 0 ? 'manual_review' : 'processed',
      source: extractionSource,
      uploadedAt,
      processedAt,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fields: parsed.fields || {},
      warnings,
      errors: [],
      rawText,
      confidence: parsed.confidence || null,
      documentType,
    };

    await updateDocumentSlot({ userId: owner.userId, rut: owner.rut, documentType, payload });
    await saveProcessedDocumentSnapshot({ userId: owner.userId, documentType, payload });
    return res.json({ documentType, document: payload, debugExtraction });
  } catch (err) {
    const errorMessage = documentProcessingMessage(err);
    const payload = {
      ...emptyDocumentPayload(documentType),
      status: 'error',
      source: 'ilovepdf',
      uploadedAt,
      processedAt: new Date().toISOString(),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      errors: [errorMessage],
    };

    try {
      await updateDocumentSlot({ userId: owner.userId, rut: owner.rut, documentType, payload });
    } catch (saveErr) {
      return next(saveErr);
    }

    return res.status(422).json({
      error: 'DOCUMENT_PROCESSING_FAILED',
      message: errorMessage,
      documentType,
      document: payload,
    });
  }
}

async function handleDocumentFieldsUpdate(req, res, next) {
  try {
    const owner = requireDocumentOwner(req, res);
    if (!owner) return;

    const { documentType } = req.params;
    if (!isAllowedDocumentType(documentType)) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
    }

    const { fields } = req.body || {};
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return res.status(400).json({ error: 'INVALID_FIELDS_PAYLOAD' });
    }

    const row = await findDocumentsByUserId(owner.userId, owner.rut);
    const current = normalizeDocumentsRow(row)[documentType];
    const normalizedFields = documentType === 'financial_profile'
      ? normalizeManualProfileFields({ ...(current.fields || {}), ...fields })
      : fields;
    const payload = {
      ...current,
      status: 'processed',
      source: current.source || 'manual',
      fields: {
        ...(current.fields || {}),
        ...normalizedFields,
      },
      warnings: [],
      errors: [],
      correctedAt: new Date().toISOString(),
      correctionsSource: 'manual_correction',
    };

    await updateDocumentSlot({ userId: owner.userId, rut: owner.rut, documentType, payload });
    await saveProcessedDocumentSnapshot({ userId: owner.userId, documentType, payload });
    return res.json({ documentType, document: payload });
  } catch (err) {
    return next(err);
  }
}

router.get('/loan-recommendation', auth(), async (req, res, next) => {
  try {
    const recommendation = await getLoanRecommendationForUser(req.user);
    return res.json(recommendation);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FINANCIAL_DATA') {
      return res.status(err.status || 422).json({
        ok: false,
        reason: err.reason || 'INSUFFICIENT_DOCUMENTS',
        message: 'No podemos generar tu recomendación personalizada porque aún faltan documentos necesarios para evaluar tu perfil financiero.',
        missingDocuments: err.missingDocuments || [],
      });
    }

    return next(err);
  }
});

router.get('/credits', auth(), async (req, res, next) => {
  try {
    const credits = await findCreditsByUserId(req.user.id);
    return res.json({
      credits: credits.map(normalizeCreditRow),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/documents', auth(), async (req, res, next) => {
  try {
    const owner = requireDocumentOwner(req, res);
    if (!owner) return;

    const row = await findDocumentsByUserId(owner.userId, owner.rut);
    return res.json({
      userId: owner.userId,
      rut: owner.rut,
      documents: normalizeDocumentsRow(row),
      requiredDocuments: REQUIRED_DOCUMENTS,
      applicationRequiredDocuments: APPLICATION_REQUIRED_DOCUMENTS,
      applicationRequiredOneOf: APPLICATION_REQUIRED_ONE_OF,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/documents/:documentType/upload', auth(), upload.single('file'), handleDocumentUpload);
router.put('/documents/:documentType/fields', auth(), handleDocumentFieldsUpdate);
router.patch('/documents/:documentType/fields', auth(), handleDocumentFieldsUpdate);

router.post('/processed-documents', auth(), async (req, res, next) => {
  try {
    const { documentType, rawText, extractedData, source } = req.body || {};
    if (!documentType || !extractedData) {
      return res.status(400).json({
        error: 'INVALID_DOCUMENT_PAYLOAD',
        message: 'documentType y extractedData son obligatorios.',
      });
    }

    const document = await saveProcessedDocument({
      userId: req.user.id,
      documentType,
      rawText,
      extractedData,
      source: source || 'manual_profile_upload',
    });

    return res.status(201).json({ document });
  } catch (err) {
    return next(err);
  }
});

export default router;
