import { Router } from 'express';
import * as controller from '../controllers/loans.controller.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/simulate', controller.simulateLoan);
router.post('/apply', auth(), controller.applyLoan);

// Deja el placeholder si quieres:
router.get('/placeholder', (_req, res) => res.json({ msg: 'Loans routes ready' }));

export default router;
