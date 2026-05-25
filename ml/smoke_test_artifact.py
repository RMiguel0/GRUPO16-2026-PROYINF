"""
Prueba rápida de carga del artefacto entrenado.

Uso:
    python smoke_test_artifact.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd


ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "random_forest_recommender.joblib"
FEATURE_COLUMNS_PATH = ARTIFACTS_DIR / "feature_columns.json"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"


def main() -> None:
    model = joblib.load(MODEL_PATH)

    with open(FEATURE_COLUMNS_PATH, "r", encoding="utf-8") as f:
        feature_columns = json.load(f)

    with open(MODEL_META_PATH, "r", encoding="utf-8") as f:
        model_meta = json.load(f)

    sample = {
        "no_of_dependents": 2,
        "self_employed": 0,
        "income_annum": 14400000,
        "loan_amount": 3000000,
        "loan_term": 3,
        "loan_to_income": 3000000 / 14400000,
        "monthly_income": 1200000,
        "estimated_monthly_payment": 3000000 / (3 * 12),
        "payment_to_income": (3000000 / (3 * 12)) / 1200000,
    }

    X = pd.DataFrame([{col: sample[col] for col in feature_columns}])
    proba = model.predict_proba(X)[0]
    pred_threshold = int(proba[1] >= model_meta.get("threshold", 0.55))

    print("Artefacto cargado correctamente.")
    print("Feature columns:", feature_columns)
    print("Clases:", getattr(model, "classes_", None))
    print("Probabilidad clase 0/Rechazado:", round(float(proba[0]), 6))
    print("Probabilidad clase 1/Aprobado:", round(float(proba[1]), 6))
    print("Predicción con umbral:", pred_threshold)


if __name__ == "__main__":
    main()
