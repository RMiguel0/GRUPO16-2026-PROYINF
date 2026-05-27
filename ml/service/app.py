"""
FastAPI service para recomendar monto y plazo.

Este servicio carga los artefactos:
- artifacts/random_forest_recommender.joblib
- artifacts/feature_columns.json
- artifacts/model_meta.json

Endpoints:
- GET /health
- POST /predict-scenarios
- POST /recommend

El modelo NO aprueba solicitudes reales. Solo entrega una señal auxiliar de viabilidad
para ordenar escenarios de monto/plazo.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator


APP_DIR = Path(__file__).resolve().parent
ML_DIR = APP_DIR.parent
ARTIFACTS_DIR = ML_DIR / "artifacts"

MODEL_PATH = ARTIFACTS_DIR / "random_forest_recommender.joblib"
FEATURE_COLUMNS_PATH = ARTIFACTS_DIR / "feature_columns.json"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"

app = FastAPI(
    title="Loan Recommendation ML Service",
    version="1.0.0",
    description="Servicio auxiliar para recomendar monto y plazo de crédito.",
)

model = None
feature_columns: List[str] = []
model_meta: Dict[str, Any] = {}


class RecommendationRequest(BaseModel):
    monthlyIncome: float = Field(..., gt=0, description="Ingreso mensual del cliente.")
    currentDebtMonthly: float = Field(0, ge=0, description="Deuda mensual actual del cliente.")
    noOfDependents: int = Field(0, ge=0, description="Número de dependientes.")
    employmentStatus: str = Field("dependiente", description="Situación laboral.")
    amountMin: float = Field(..., gt=0)
    amountMax: float = Field(..., gt=0)
    amountStep: float = Field(..., gt=0)
    terms: List[int] = Field(..., min_length=1, description="Plazos a evaluar, en meses.")
    annualInterestRate: float = Field(0.055, ge=0, description="Tasa anual para calcular cuota real mostrada.")
    maxTotalBurden: float = Field(0.40, gt=0, le=1, description="Carga financiera máxima permitida.")
    threshold: Optional[float] = Field(None, ge=0, le=1, description="Umbral opcional. Si se omite, usa metadata.")

    @field_validator("amountMax")
    @classmethod
    def validate_amount_range(cls, value: float, info):
        amount_min = info.data.get("amountMin")
        if amount_min is not None and value < amount_min:
            raise ValueError("amountMax debe ser mayor o igual que amountMin")
        return value

    @field_validator("terms")
    @classmethod
    def validate_terms(cls, value: List[int]):
        if any(term <= 0 for term in value):
            raise ValueError("Todos los plazos deben ser positivos")
        return value


class ScenarioRequest(BaseModel):
    scenarios: List[Dict[str, Any]]
    threshold: Optional[float] = Field(None, ge=0, le=1)


def load_artifacts() -> None:
    global model, feature_columns, model_meta

    missing = [
        str(path)
        for path in [MODEL_PATH, FEATURE_COLUMNS_PATH, MODEL_META_PATH]
        if not path.exists()
    ]
    if missing:
        raise RuntimeError(
            "Faltan artefactos del modelo. Ejecuta train_export_recommender.py. "
            f"Archivos faltantes: {missing}"
        )

    model = joblib.load(MODEL_PATH)

    with open(FEATURE_COLUMNS_PATH, "r", encoding="utf-8") as f:
        feature_columns = json.load(f)

    with open(MODEL_META_PATH, "r", encoding="utf-8") as f:
        model_meta = json.load(f)


@app.on_event("startup")
def startup_event() -> None:
    load_artifacts()


def is_self_employed(status: str) -> int:
    normalized = status.strip().lower()
    self_employed_terms = {
        "self-employed",
        "self employed",
        "independiente",
        "autonomo",
        "autónomo",
        "freelance",
        "emprendedor",
    }
    return 1 if normalized in self_employed_terms else 0


def amortized_payment(principal: float, annual_rate: float, term_months: int) -> float:
    """Cuota mensual con amortización francesa."""
    if term_months <= 0:
        raise ValueError("term_months debe ser positivo")

    if annual_rate <= 0:
        return principal / term_months

    monthly_rate = annual_rate / 12
    return principal * (monthly_rate * (1 + monthly_rate) ** term_months) / (
        ((1 + monthly_rate) ** term_months) - 1
    )


def build_feature_row(
    monthly_income: float,
    no_of_dependents: int,
    self_employed: int,
    loan_amount: float,
    term_months: int,
) -> Dict[str, float]:
    """
    Construye las features exactamente con el significado usado en entrenamiento.

    En entrenamiento, loan_term venía en años. Por eso:
        loan_term = term_months / 12

    estimated_monthly_payment replica la variable del notebook:
        loan_amount / (loan_term * 12)
    que equivale a loan_amount / term_months.
    """
    income_annum = monthly_income * 12
    loan_term_years = term_months / 12

    if income_annum <= 0:
        raise ValueError("income_annum debe ser positivo")

    estimated_monthly_payment = loan_amount / term_months

    row = {
        "no_of_dependents": no_of_dependents,
        "self_employed": self_employed,
        "income_annum": income_annum,
        "loan_amount": loan_amount,
        "loan_term": loan_term_years,
        "loan_to_income": loan_amount / income_annum,
        "monthly_income": monthly_income,
        "estimated_monthly_payment": estimated_monthly_payment,
        "payment_to_income": estimated_monthly_payment / monthly_income,
    }

    return row


def predict_probability(feature_row: Dict[str, Any]) -> float:
    if model is None:
        raise RuntimeError("El modelo no está cargado")

    missing = [col for col in feature_columns if col not in feature_row]
    if missing:
        raise ValueError(f"Faltan features requeridas: {missing}")

    X = pd.DataFrame([{col: feature_row[col] for col in feature_columns}])
    return float(model.predict_proba(X)[0][1])


def generate_amounts(amount_min: float, amount_max: float, amount_step: float) -> List[float]:
    amounts = []
    current = amount_min

    # Evita loops infinitos por errores de float.
    max_iterations = 10000
    iterations = 0

    while current <= amount_max + 1e-9:
        amounts.append(float(round(current, 2)))
        current += amount_step
        iterations += 1
        if iterations > max_iterations:
            raise ValueError("Demasiados escenarios. Revisa amountMin, amountMax y amountStep.")

    return amounts


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "feature_columns": feature_columns,
        "threshold": model_meta.get("threshold"),
    }


@app.post("/predict-scenarios")
def predict_scenarios(payload: ScenarioRequest) -> Dict[str, Any]:
    """
    Predice probabilidad para escenarios ya construidos.
    Cada escenario debe contener las columnas en feature_columns.
    """
    threshold = payload.threshold
    if threshold is None:
        threshold = float(model_meta.get("threshold", 0.55))

    results = []
    for scenario in payload.scenarios:
        probability = predict_probability(scenario)
        results.append(
            {
                "approvalProbability": probability,
                "passesThreshold": probability >= threshold,
                "scenario": scenario,
            }
        )

    return {
        "threshold": threshold,
        "results": results,
    }


@app.post("/recommend")
def recommend(payload: RecommendationRequest) -> Dict[str, Any]:
    threshold = payload.threshold
    if threshold is None:
        threshold = float(model_meta.get("threshold", 0.55))

    self_employed = is_self_employed(payload.employmentStatus)
    amounts = generate_amounts(payload.amountMin, payload.amountMax, payload.amountStep)

    all_scenarios = []
    discarded_by_debt = 0
    discarded_by_model = 0
    candidates = []

    for amount in amounts:
        for term_months in payload.terms:
            feature_row = build_feature_row(
                monthly_income=payload.monthlyIncome,
                no_of_dependents=payload.noOfDependents,
                self_employed=self_employed,
                loan_amount=amount,
                term_months=term_months,
            )

            monthly_payment = amortized_payment(
                principal=amount,
                annual_rate=payload.annualInterestRate,
                term_months=term_months,
            )

            total_burden = (payload.currentDebtMonthly + monthly_payment) / payload.monthlyIncome
            payment_to_income_real = monthly_payment / payload.monthlyIncome

            scenario_public = {
                "amount": amount,
                "termMonths": term_months,
                "loanTermYearsForModel": feature_row["loan_term"],
                "monthlyPayment": round(monthly_payment, 2),
                "paymentToIncome": round(payment_to_income_real, 6),
                "totalBurden": round(total_burden, 6),
                "features": feature_row,
            }

            all_scenarios.append(scenario_public)

            if total_burden > payload.maxTotalBurden:
                discarded_by_debt += 1
                continue

            approval_probability = predict_probability(feature_row)
            scenario_public["approvalProbability"] = round(approval_probability, 6)
            scenario_public["passesModelThreshold"] = approval_probability >= threshold

            if approval_probability < threshold:
                discarded_by_model += 1
                continue

            candidates.append(scenario_public)

    # Ranking definido para el recomendador:
    # 1) mayor monto viable
    # 2) mayor probabilidad
    # 3) menor carga total
    # 4) menor plazo
    candidates.sort(
        key=lambda item: (
            item["amount"],
            item.get("approvalProbability", 0),
            -item["totalBurden"],
            -item["termMonths"],
        ),
        reverse=True,
    )

    recommendation = candidates[0] if candidates else None
    alternatives = candidates[1:6] if len(candidates) > 1 else []

    # Si no hay recomendación, devolvemos el mejor escenario dentro del filtro de deuda
    # para ayudar a depurar la interfaz, sin presentarlo como recomendación aprobada.
    best_within_debt = None
    if recommendation is None:
        within_debt = []
        for scenario in all_scenarios:
            if scenario["totalBurden"] <= payload.maxTotalBurden:
                try:
                    probability = predict_probability(scenario["features"])
                    scenario = dict(scenario)
                    scenario["approvalProbability"] = round(probability, 6)
                    within_debt.append(scenario)
                except Exception:
                    pass
        within_debt.sort(
            key=lambda item: (
                item.get("approvalProbability", 0),
                item["amount"],
                -item["totalBurden"],
            ),
            reverse=True,
        )
        best_within_debt = within_debt[0] if within_debt else None

    return {
        "threshold": threshold,
        "maxTotalBurden": payload.maxTotalBurden,
        "annualInterestRate": payload.annualInterestRate,
        "recommendation": recommendation,
        "alternatives": alternatives,
        "bestScenarioWithinDebtFilter": best_within_debt,
        "discardedSummary": {
            "totalScenarios": len(all_scenarios),
            "discardedByDebtFilter": discarded_by_debt,
            "discardedByModelThreshold": discarded_by_model,
            "acceptedCandidates": len(candidates),
        },
        "note": (
            "Esta respuesta recomienda escenarios de monto/plazo. "
            "No aprueba ni rechaza solicitudes reales y no reemplaza el scoring formal."
        ),
    }
