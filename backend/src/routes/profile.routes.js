import { Router } from 'express';
import multer from 'multer';
import auth from '../middlewares/auth.js';
import { saveProcessedDocument } from '../db/repositories/document.repository.js';
import {
  DOCUMENT_COLUMNS,
  findDocumentsByRut,
  updateDocumentSlot,
} from '../db/repositories/documents.repository.js';
import { getLoanRecommendationForUser } from '../services/recommendation.service.js';
import { extractTextFromPdf } from '../services/ocrpdf.service.js';
import { analyzeDocument } from '../services/documentParser.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const REQUIRED_DOCUMENTS = ['identity', 'afp_imponibles', 'salary', 'cmf_debt'];

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

async function handleDocumentUpload(req, res, next) {
  const rut = requireUserRut(req, res);
  if (!rut) return;

  const { documentType } = req.params;
  if (!isAllowedDocumentType(documentType)) {
    return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'MISSING_FILE' });
  }

  if (req.file.mimetype !== 'application/pdf') {
    return res.status(415).json({
      error: 'UNSUPPORTED_FILE_TYPE',
      message: 'Por ahora la carga documental del perfil procesa archivos PDF.',
    });
  }

  const uploadedAt = new Date().toISOString();

  try {
    const rawText = await extractTextFromPdf(req.file.buffer, req.file.originalname);
    const parsed = parseExtractedText(rawText, documentType);
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const processedAt = new Date().toISOString();

    const payload = {
      status: warnings.length > 0 ? 'manual_review' : 'processed',
      source: 'ilovepdf',
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

    await updateDocumentSlot({ rut, documentType, payload });
    return res.json({ documentType, document: payload });
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
      await updateDocumentSlot({ rut, documentType, payload });
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
    const rut = requireUserRut(req, res);
    if (!rut) return;

    const { documentType } = req.params;
    if (!isAllowedDocumentType(documentType)) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
    }

    const { fields } = req.body || {};
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return res.status(400).json({ error: 'INVALID_FIELDS_PAYLOAD' });
    }

    const row = await findDocumentsByRut(rut);
    const current = normalizeDocumentsRow(row)[documentType];
    const payload = {
      ...current,
      status: current.status === 'missing' ? 'manual_review' : current.status,
      source: current.source || 'manual',
      fields: {
        ...(current.fields || {}),
        ...fields,
      },
      correctedAt: new Date().toISOString(),
      correctionsSource: 'manual_correction',
    };

    await updateDocumentSlot({ rut, documentType, payload });
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
    const rut = requireUserRut(req, res);
    if (!rut) return;

    const row = await findDocumentsByRut(rut);
    return res.json({
      rut,
      documents: normalizeDocumentsRow(row),
      requiredDocuments: REQUIRED_DOCUMENTS,
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
