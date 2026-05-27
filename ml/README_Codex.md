# Paquete ML para recomendador de monto y plazo

Este paquete contiene solamente los archivos del modelo/servicio ML.  
No incluye cambios del backend ni del frontend del repo principal.

## Objetivo

Recomendar combinaciones de **monto** y **plazo** para un crédito de consumo usando:

1. Un modelo `RandomForestClassifier` entrenado con el dataset público.
2. Un umbral operativo de `0.55` sobre `P(clase 1 = Approved)`.
3. Un filtro externo de deuda/carga financiera.
4. Ranking de escenarios viables.

Este modelo **no aprueba créditos reales** y **no reemplaza el scoring formal de evaluación**.

---

## Estructura

```text
ml/
  data/
    loan_approval_dataset.csv
  artifacts/
    random_forest_recommender.joblib
    feature_columns.json
    model_meta.json
    metrics.json
    sample_input.json
  service/
    app.py
  train_export_recommender.py
  smoke_test_artifact.py
  requirements.txt
  Dockerfile
  README_Codex.md
```

---

## Variables usadas por el modelo

El modelo fue entrenado con estas columnas, en este orden:

```text
no_of_dependents
self_employed
income_annum
loan_amount
loan_term
loan_to_income
monthly_income
estimated_monthly_payment
payment_to_income
```

### Importante sobre `loan_term`

En el dataset original, `loan_term` viene en años.  
Si la interfaz usa plazos en meses, convertir:

```text
loan_term = termMonths / 12
```

La variable derivada del notebook se calcula como:

```text
estimated_monthly_payment = loan_amount / (loan_term * 12)
```

Equivale a:

```text
estimated_monthly_payment = loan_amount / termMonths
```

---

## Entrenar/exportar artefactos

Desde la carpeta `ml`:

```bash
pip install -r requirements.txt
python train_export_recommender.py --data ./data/loan_approval_dataset.csv
```

Esto genera:

```text
artifacts/random_forest_recommender.joblib
artifacts/feature_columns.json
artifacts/model_meta.json
artifacts/metrics.json
artifacts/sample_input.json
```

---

## Smoke test

```bash
python smoke_test_artifact.py
```

---

## Levantar servicio FastAPI

```bash
uvicorn service.app:app --host 0.0.0.0 --port 8000
```

Luego probar:

```bash
curl http://localhost:8000/health
```

---

## Endpoint principal

```http
POST /recommend
```

Ejemplo de body:

```json
{
  "monthlyIncome": 1200000,
  "currentDebtMonthly": 180000,
  "noOfDependents": 2,
  "employmentStatus": "dependiente",
  "amountMin": 500000,
  "amountMax": 8000000,
  "amountStep": 500000,
  "terms": [12, 24, 36, 48, 60],
  "annualInterestRate": 0.055,
  "maxTotalBurden": 0.40
}
```

Respuesta esperada:

```json
{
  "threshold": 0.55,
  "maxTotalBurden": 0.4,
  "recommendation": {
    "amount": 3000000,
    "termMonths": 36,
    "approvalProbability": 0.61,
    "monthlyPayment": 90575.32,
    "paymentToIncome": 0.0754,
    "totalBurden": 0.2254
  },
  "alternatives": [],
  "discardedSummary": {
    "totalScenarios": 80,
    "discardedByDebtFilter": 15,
    "discardedByModelThreshold": 30,
    "acceptedCandidates": 35
  }
}
```

---

## Reglas usadas en el servicio

### Filtro de deuda

```text
totalBurden = (currentDebtMonthly + monthlyPayment) / monthlyIncome
```

Se descarta un escenario si:

```text
totalBurden > maxTotalBurden
```

Valor por defecto:

```text
maxTotalBurden = 0.40
```

### Filtro del modelo

Se descarta un escenario si:

```text
approvalProbability < 0.55
```

### Ranking

Los escenarios viables se ordenan por:

1. Mayor monto.
2. Mayor probabilidad del modelo.
3. Menor carga financiera total.
4. Menor plazo.

---

## Nota para integración con repo principal

El backend del repo debe llamar a este servicio por HTTP.  
Este paquete no toca ni reemplaza archivos como `scoring.js`.
