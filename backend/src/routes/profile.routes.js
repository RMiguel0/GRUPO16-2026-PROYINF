import { Router } from 'express';
import multer from 'multer';
import auth from '../middlewares/auth.js';
import { saveProcessedDocument } from '../db/repositories/document.repository.js';
import {
  DOCUMENT_COLUMNS,
  findDocumentsByUserId,
  updateDocumentSlot,
} from '../db/repositories/documents.repository.js';
import { getLoanRecommendationForUser } from '../services/recommendation.service.js';
import {
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

const REQUIRED_DOCUMENTS = ['identity', 'afp_imponibles', 'salary', 'cmf_debt'];
const APPLICATION_REQUIRED_DOCUMENTS = ['identity', 'cmf_debt', 'financial_profile'];
const APPLICATION_REQUIRED_ONE_OF = [['salary', 'afp_imponibles']];

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
    const iloveRawText = await extractTextFromPdf(pdfBuffer, pdfFilename);
    let rawText = sanitizeExtractedText(iloveRawText);
    let originalRawText = iloveRawText;
    let extractionSource = isIdentityImage ? 'ilovepdf_imagepdf_extract' : 'ilovepdf';

    const debugExtraction = buildExtractionDebug(originalRawText, rawText, {
      sourceUsed: extractionSource,
      inputMimeType: req.file.mimetype,
      convertedToPdf: isIdentityImage,
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
    return res.json({ documentType, document: payload, debugExtraction });
  } catch (err) {
    const payload = {
      ...emptyDocumentPayload(documentType),
      status: 'error',
      source: 'ilovepdf',
      uploadedAt,
      processedAt: new Date().toISOString(),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      errors: [err.message || 'No se pudo procesar el documento.'],
    };

    try {
      await updateDocumentSlot({ userId: owner.userId, rut: owner.rut, documentType, payload });
    } catch (saveErr) {
      return next(saveErr);
    }

    return res.status(422).json({
      error: 'DOCUMENT_PROCESSING_FAILED',
      message: err.message || 'No se pudo procesar el documento.',
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
    const payload = {
      ...current,
      status: 'processed',
      source: current.source || 'manual',
      fields: {
        ...(current.fields || {}),
        ...fields,
      },
      warnings: [],
      errors: [],
      correctedAt: new Date().toISOString(),
      correctionsSource: 'manual_correction',
    };

    await updateDocumentSlot({ userId: owner.userId, rut: owner.rut, documentType, payload });
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
        error: err.code,
        missingFields: err.missingFields || [],
        requiredDocuments: err.requiredDocuments || {},
      });
    }

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
