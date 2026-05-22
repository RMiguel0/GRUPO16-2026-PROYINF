import { Router } from 'express';
import * as controller from '../controllers/loans.controller.js';
import { attachUser } from '../middlewares/auth.js';

const router = Router();

// Ruta de prueba para BCI
router.post('/bci-test', controller.testBciSimulation);
router.post('/simulate', controller.simulateLoan);
router.post('/apply', attachUser, controller.applyLoan);

// Deja el placeholder si quieres:
router.get('/placeholder', (_req, res) => res.json({ msg: 'Loans routes ready' }));

export default router;
