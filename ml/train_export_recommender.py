"""
Entrena y exporta el modelo auxiliar de recomendación de monto/plazo.

Este modelo NO reemplaza el scoring formal de evaluación de crédito.
Su rol es entregar una señal de viabilidad histórica para rankear escenarios
de monto y plazo en el recomendador.

Modelo replicado desde experimento2.ipynb:
- RandomForestClassifier
- n_estimators=100
- max_depth=10
- class_weight="balanced"
- random_state=25
- train/test split random_state=42, stratify=y
- umbral operativo recomendado: 0.55 sobre P(clase 1 = Approved)

Uso:
    python train_export_recommender.py --data ./data/loan_approval_dataset.csv
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS: List[str] = [
    "no_of_dependents",
    "self_employed",
    "income_annum",
    "loan_amount",
    "loan_term",
    "loan_to_income",
    "monthly_income",
    "estimated_monthly_payment",
    "payment_to_income",
]

TARGET_COLUMN = "loan_status"

MODEL_PARAMS: Dict = {
    "n_estimators": 100,
    "max_depth": 10,
    "class_weight": "balanced",
    "random_state": 25,
}

THRESHOLD = 0.55
TRAIN_TEST_RANDOM_STATE = 42
TRAIN_SIZE = 0.8


def _safe_div(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Divide evitando inf cuando el denominador es 0."""
    result = numerator / denominator.replace(0, pd.NA)
    return result.fillna(0)


def load_and_prepare_data(csv_path: str | Path) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Carga el dataset público y deja solo las variables disponibles para el proyecto,
    más las variables derivadas usadas por el recomendador.

    Importante:
    - En este dataset, loan_term viene en años.
    - Para entrenar se usa estimated_monthly_payment = loan_amount / (loan_term * 12).
    - En producción, si el usuario entrega termMonths, debe convertirse a años:
      loan_term = termMonths / 12.
    """
    df = pd.read_csv(csv_path)

    # El dataset original trae espacios al inicio de varios nombres de columnas.
    df.columns = df.columns.str.strip()

    # Limpiar valores categóricos.
    for col in ["self_employed", "loan_status"]:
        if col in df.columns and df[col].dtype == "object":
            df[col] = df[col].str.strip()

    # Mantener solo variables disponibles + target.
    keep_columns = [
        "no_of_dependents",
        "self_employed",
        "income_annum",
        "loan_amount",
        "loan_term",
        "loan_status",
    ]
    missing = [col for col in keep_columns if col not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas requeridas en el dataset: {missing}")

    data = df[keep_columns].copy()

    # Mapear categóricas.
    data["self_employed"] = data["self_employed"].map({"No": 0, "Yes": 1})
    data["loan_status"] = data["loan_status"].map({"Rejected": 0, "Approved": 1})

    if data["self_employed"].isna().any():
        bad_values = sorted(df.loc[data["self_employed"].isna(), "self_employed"].dropna().unique())
        raise ValueError(f"Valores inesperados en self_employed: {bad_values}")

    if data["loan_status"].isna().any():
        bad_values = sorted(df.loc[data["loan_status"].isna(), "loan_status"].dropna().unique())
        raise ValueError(f"Valores inesperados en loan_status: {bad_values}")

    # Variables derivadas replicadas desde el notebook.
    data["loan_to_income"] = _safe_div(data["loan_amount"], data["income_annum"])
    data["monthly_income"] = data["income_annum"] / 12
    data["estimated_monthly_payment"] = _safe_div(data["loan_amount"], data["loan_term"] * 12)
    data["payment_to_income"] = _safe_div(data["estimated_monthly_payment"], data["monthly_income"])

    X = data[FEATURE_COLUMNS].copy()
    y = data[TARGET_COLUMN].astype(int).copy()

    return X, y


def evaluate_model(model: RandomForestClassifier, X_test: pd.DataFrame, y_test: pd.Series) -> Dict:
    """Evalúa con predict normal y con umbral operativo."""
    y_pred_default = model.predict(X_test)

    proba_approved = model.predict_proba(X_test)[:, 1]
    y_pred_threshold = (proba_approved >= THRESHOLD).astype(int)

    return {
        "default_predict": {
            "accuracy": float(accuracy_score(y_test, y_pred_default)),
            "macro_f1": float(f1_score(y_test, y_pred_default, average="macro")),
            "confusion_matrix": confusion_matrix(y_test, y_pred_default).tolist(),
            "classification_report": classification_report(y_test, y_pred_default, output_dict=True),
        },
        "threshold_predict": {
            "threshold": THRESHOLD,
            "accuracy": float(accuracy_score(y_test, y_pred_threshold)),
            "macro_f1": float(f1_score(y_test, y_pred_threshold, average="macro")),
            "confusion_matrix": confusion_matrix(y_test, y_pred_threshold).tolist(),
            "classification_report": classification_report(y_test, y_pred_threshold, output_dict=True),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        default="./data/loan_approval_dataset.csv",
        help="Ruta al CSV loan_approval_dataset.csv",
    )
    parser.add_argument(
        "--artifacts-dir",
        default="./artifacts",
        help="Carpeta donde se guardarán modelo y metadata.",
    )
    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    X, y = load_and_prepare_data(args.data)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        train_size=TRAIN_SIZE,
        random_state=TRAIN_TEST_RANDOM_STATE,
        stratify=y,
    )

    model = RandomForestClassifier(**MODEL_PARAMS)
    model.fit(X_train, y_train)

    metrics = evaluate_model(model, X_test, y_test)

    model_path = artifacts_dir / "random_forest_recommender.joblib"
    feature_columns_path = artifacts_dir / "feature_columns.json"
    meta_path = artifacts_dir / "model_meta.json"
    metrics_path = artifacts_dir / "metrics.json"
    sample_input_path = artifacts_dir / "sample_input.json"

    joblib.dump(model, model_path)

    with open(feature_columns_path, "w", encoding="utf-8") as f:
        json.dump(FEATURE_COLUMNS, f, indent=2, ensure_ascii=False)

    model_meta = {
        "model_name": "random_forest_recommender",
        "model_type": "RandomForestClassifier",
        "model_params": MODEL_PARAMS,
        "threshold": THRESHOLD,
        "negative_class": 0,
        "negative_class_label": "Rejected",
        "positive_class": 1,
        "positive_class_label": "Approved",
        "train_size": TRAIN_SIZE,
        "train_test_random_state": TRAIN_TEST_RANDOM_STATE,
        "feature_columns": FEATURE_COLUMNS,
        "loan_term_unit_in_training": "years",
        "term_months_conversion": "loan_term = termMonths / 12",
        "derived_features": {
            "loan_to_income": "loan_amount / income_annum",
            "monthly_income": "income_annum / 12",
            "estimated_monthly_payment": "loan_amount / (loan_term * 12)",
            "payment_to_income": "estimated_monthly_payment / monthly_income",
        },
        "recommendation_defaults": {
            "annual_interest_rate": 0.055,
            "max_total_burden": 0.40,
            "threshold": THRESHOLD,
        },
        "purpose": (
            "Modelo auxiliar para recomendar monto y plazo. "
            "No aprueba créditos y no reemplaza el scoring formal de evaluación."
        ),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(model_meta, f, indent=2, ensure_ascii=False)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    sample_input = {
        "monthlyIncome": 1200000,
        "currentDebtMonthly": 180000,
        "noOfDependents": 2,
        "employmentStatus": "dependiente",
        "amountMin": 500000,
        "amountMax": 8000000,
        "amountStep": 500000,
        "terms": [12, 24, 36, 48, 60],
        "annualInterestRate": 0.055,
        "maxTotalBurden": 0.40,
    }
    with open(sample_input_path, "w", encoding="utf-8") as f:
        json.dump(sample_input, f, indent=2, ensure_ascii=False)

    print("Modelo exportado correctamente.")
    print(f"- Modelo: {model_path}")
    print(f"- Features: {feature_columns_path}")
    print(f"- Metadata: {meta_path}")
    print(f"- Métricas: {metrics_path}")
    print(f"- Sample input: {sample_input_path}")
    print("\nMatriz con umbral 0.55:")
    print(metrics["threshold_predict"]["confusion_matrix"])
    print("\nReporte con umbral 0.55:")
    print(json.dumps(metrics["threshold_predict"]["classification_report"], indent=2))


if __name__ == "__main__":
    main()
