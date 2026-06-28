import { Router } from 'express';
import * as controller from '../controllers/loans.controller.js';
import auth from '../middlewares/auth.js';
import { firmarPrestamo } from '../controllers/loans.controller.js';

const router = Router();

router.post('/firmar-prestamo', auth(), firmarPrestamo);
router.post('/simulate', controller.simulateLoan);
router.post('/apply', auth(), controller.applyLoan);
router.post('/:creditId/confirm', auth(), controller.confirmCredit);

// Deja el placeholder si quieres:
router.get('/placeholder', (_req, res) => res.json({ msg: 'Loans routes ready' }));

export default router;
