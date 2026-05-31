// Controladores: reciben req/res y llaman a services.
import { evaluateApplication } from '../utils/scoring.js';
import { createLoanApplication } from '../db/repositories/loan.repository.js';
import {
  CREDIT_STATUS,
  createCredit,
  findCreditByIdForUser,
  updateCreditStatus,
} from '../db/repositories/credits.repository.js';

/**
 * Simulate a loan offer given the applicant's information. It expects a
 * request body containing at least amount, termMonths, monthlyIncome and
 * employmentStatus. It returns the computed score, risk category, monthly
 * payment estimate and either an interest rate offer or an indication that
 * the applicant is rejected due to high risk.
 *
 * Example request body:
 * {
 *   "amount": 50000,
 *   "termMonths": 60,
 *   "monthlyIncome": 1200000,
 *   "employmentStatus": "employed"
 * }
 */
export async function simulateLoan(req, res, next) {
  try {
    const {
      amount,
      termMonths,
      monthlyIncome,
      employmentStatus,
    } = req.body;

    // Validate required fields. If any are missing or invalid, return a 400.
    if (
      amount === undefined ||
      termMonths === undefined ||
      monthlyIncome === undefined ||
      employmentStatus === undefined
    ) {
      return res.status(400).json({ error: 'Campos requeridos faltantes: amount, termMonths, monthlyIncome, employmentStatus' });
    }

    const parsedAmount = Number(amount);
    const parsedTerm = Number(termMonths);
    const parsedIncome = Number(monthlyIncome);

    if (Number.isNaN(parsedAmount) || Number.isNaN(parsedTerm) || Number.isNaN(parsedIncome) || parsedAmount <= 0 || parsedTerm <= 0 || parsedIncome <= 0) {
      return res.status(400).json({ error: 'Los valores amount, termMonths y monthlyIncome deben ser números positivos.' });
    }

    const result = evaluateApplication(parsedAmount, parsedTerm, parsedIncome, employmentStatus);

    // If rejected, return 200 with rejection info. The frontend can handle this case gracefully.
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

function paymentTotals({ amount, termMonths, monthlyPayment }) {
  const payment = Number(monthlyPayment);
  const term = Number(termMonths);
  const principal = Number(amount);

  if (!Number.isFinite(payment) || !Number.isFinite(term) || !Number.isFinite(principal)) {
    return { totalPayment: null, totalInterest: null };
  }

  const totalPayment = Math.round(payment * term);
  return {
    totalPayment,
    totalInterest: Math.max(0, totalPayment - principal),
  };
}

function requireUserRut(req, res) {
  if (!req.user?.rut) {
    res.status(409).json({
      error: 'MISSING_USER_RUT',
      message: 'Debes tener un RUT asociado a tu cuenta para solicitar creditos.',
    });
    return null;
  }

  return req.user.rut;
}

function creditMessageForRejection() {
  return 'No cumples las condiciones para este credito.';
}

/**
 * Apply for a real loan. This endpoint persists the application and its
 * evaluation in the database. It expects applicant details, financial
 * information and loan terms. Every evaluated application is stored. Rejected
 * applications create a rejected credit attempt, while approved applications
 * create a processing credit that becomes active only after contract confirmation.
 *
 * Expected body:
 * {
 *   "identification": "12345678-9",
 *   "fullName": "Juan Pérez",
 *   "email": "juan@example.com",
 *   "phone": "+56912345678",
 *   "monthlyIncome": 1200000,
 *   "employmentStatus": "employed",
 *   "amount": 50000,
 *   "termMonths": 60
 * }
 */
export async function applyLoan(req, res, next) {
  try {
    const rut = requireUserRut(req, res);
    if (!rut) return;

    const {
      identification,
      fullName,
      email,
      phone,
      monthlyIncome,
      employmentStatus,
      amount,
      termMonths,
    } = req.body || {};

    // Validate required fields
    if (
      !identification ||
      !fullName ||
      monthlyIncome === undefined ||
      employmentStatus === undefined ||
      amount === undefined ||
      termMonths === undefined
    ) {
      return res
        .status(400)
        .json({ error: 'Campos requeridos faltantes: identification, fullName, amount, termMonths, monthlyIncome, employmentStatus' });
    }

    const amt = Number(amount);
    const term = Number(termMonths);
    const income = Number(monthlyIncome);
    if (Number.isNaN(amt) || Number.isNaN(term) || Number.isNaN(income) || amt <= 0 || term <= 0 || income <= 0) {
      return res.status(400).json({ error: 'Los valores amount, termMonths y monthlyIncome deben ser números positivos.' });
    }

    const evalResult = evaluateApplication(amt, term, income, employmentStatus);
    const totals = paymentTotals({
      amount: amt,
      termMonths: term,
      monthlyPayment: evalResult.monthlyPayment,
    });

    const record = await createLoanApplication({
      user_id: req.user.id,
      identification,
      full_name: fullName,
      email,
      phone,
      monthly_income: income,
      employment_status: employmentStatus,
      requested_amount: amt,
      requested_term_months: term,
      score: evalResult.score,
      risk: evalResult.risk,
      interest_rate_monthly: evalResult.interestRateMonthly,
      interest_rate_annual: evalResult.interestRateAnnual,
      monthly_payment: evalResult.monthlyPayment,
      rejected: evalResult.rejected,
    });

    const credit = await createCredit({
      userId: req.user.id,
      rut,
      status: evalResult.rejected ? CREDIT_STATUS.REJECTED : CREDIT_STATUS.PROCESSING,
      amount: amt,
      termMonths: term,
      interestRateMonthly: evalResult.interestRateMonthly,
      interestRateAnnual: evalResult.interestRateAnnual,
      monthlyPayment: evalResult.monthlyPayment,
      totalPayment: totals.totalPayment,
      totalInterest: totals.totalInterest,
      score: evalResult.score,
      risk: evalResult.risk,
      rejectionReason: evalResult.rejected ? creditMessageForRejection() : null,
      sourceApplicationId: record.id,
      metadata: {
        applicant: {
          identification,
          fullName,
          email,
          phone,
          monthlyIncome: income,
          employmentStatus,
        },
        breakdown: evalResult.breakdown,
      },
      rejectedAt: evalResult.rejected ? new Date().toISOString() : null,
    });

    if (evalResult.rejected) {
      return res.json({
        ...evalResult,
        message: creditMessageForRejection(),
        application: record,
        credit,
      });
    }

    return res.json({ ...evalResult, application: record, credit });
  } catch (err) {
    return next(err);
  }
}

export async function confirmCredit(req, res, next) {
  try {
    const { creditId } = req.params;
    const credit = await findCreditByIdForUser({ creditId, userId: req.user.id });

    if (!credit) {
      return res.status(404).json({ error: 'CREDIT_NOT_FOUND' });
    }

    if (Number(credit.status) === CREDIT_STATUS.REJECTED) {
      return res.status(409).json({
        error: 'CREDIT_REJECTED',
        message: 'No se puede confirmar un credito rechazado.',
      });
    }

    if (Number(credit.status) === CREDIT_STATUS.ACTIVE) {
      return res.json({ credit, alreadyConfirmed: true });
    }

    if (Number(credit.status) !== CREDIT_STATUS.PROCESSING) {
      return res.status(409).json({
        error: 'INVALID_CREDIT_STATUS',
        message: 'Solo se pueden confirmar creditos en procesamiento.',
      });
    }

    const updated = await updateCreditStatus({
      creditId,
      userId: req.user.id,
      status: CREDIT_STATUS.ACTIVE,
      patch: {
        confirmedAt: new Date().toISOString(),
      },
    });

    return res.json({ credit: updated });
  } catch (err) {
    return next(err);
  }
}

