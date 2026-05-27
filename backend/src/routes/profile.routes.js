import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { saveProcessedDocument } from '../db/repositories/document.repository.js';
import { getLoanRecommendationForUser } from '../services/recommendation.service.js';

const router = Router();

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
