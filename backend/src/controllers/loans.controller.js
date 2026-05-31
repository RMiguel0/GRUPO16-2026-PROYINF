// Controladores: reciben req/res y llaman a services.
import { evaluateApplication } from '../utils/scoring.js';
import { createLoanApplication } from '../db/repositories/loan.repository.js';
import { CREDIT_STATUS, createCredit } from '../db/repositories/credits.repository.js';

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

/**
 * Apply for a real loan. This endpoint persists the application and its
 * evaluation in the database. It expects applicant details, financial
 * information and loan terms. If the evaluation deems the applicant high
 * risk (rejected) it returns the evaluation without storing. Otherwise it
 * stores the application and returns both the evaluation and the saved
 * record.
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

    // If high risk, store the rejected credit attempt without creating a loan_application row.
    if (evalResult.rejected) {
      const credit = await createCredit({
        userId: req.user.id,
        rut: req.user.rut,
        status: CREDIT_STATUS.REJECTED,
        amount: amt,
        termMonths: term,
        interestRateMonthly: evalResult.interestRateMonthly,
        interestRateAnnual: evalResult.interestRateAnnual,
        monthlyPayment: evalResult.monthlyPayment,
        totalPayment: totals.totalPayment,
        totalInterest: totals.totalInterest,
        score: evalResult.score,
        risk: evalResult.risk,
        rejectionReason: 'Solicitud rechazada por alto riesgo.',
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
        rejectedAt: new Date().toISOString(),
      });

      return res.json({ ...evalResult, credit });
    }

    // Persist the application
    const record = await createLoanApplication({
      user_id: req.user?.id ?? null,
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
      rut: req.user.rut,
      status: CREDIT_STATUS.ACTIVE,
      amount: amt,
      termMonths: term,
      interestRateMonthly: evalResult.interestRateMonthly,
      interestRateAnnual: evalResult.interestRateAnnual,
      monthlyPayment: evalResult.monthlyPayment,
      totalPayment: totals.totalPayment,
      totalInterest: totals.totalInterest,
      score: evalResult.score,
      risk: evalResult.risk,
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
      confirmedAt: new Date().toISOString(),
    });

    return res.json({ ...evalResult, application: record, credit });
  } catch (err) {
    return next(err);
  }
}

