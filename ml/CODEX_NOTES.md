# Notas para Codex - Integración del recomendador

## Qué recibe esta carpeta

Esta carpeta contiene SOLO los archivos del modelo/servicio ML, sin modificaciones del repo principal.

El repo principal será entregado aparte.

## Decisiones ya tomadas

- Modelo auxiliar: RandomForestClassifier.
- Umbral operativo: 0.55 sobre P(clase 1 = Approved).
- Clase 0 = Rejected.
- Clase 1 = Approved.
- La deuda mensual actual NO fue usada para entrenar porque el dataset no la trae.
- La deuda mensual se usa como filtro externo en el recomendador.
- El modelo recomienda monto/plazo. No aprueba ni rechaza solicitudes reales.
- No se debe mezclar con el scoring formal de evaluación de crédito.

## Archivos clave

- `artifacts/random_forest_recommender.joblib`: modelo entrenado.
- `artifacts/feature_columns.json`: orden exacto de columnas para inferencia.
- `artifacts/model_meta.json`: metadata, umbral, explicación y defaults.
- `artifacts/metrics.json`: métricas del entrenamiento.
- `service/app.py`: servicio FastAPI listo para exponer `/recommend`.
- `train_export_recommender.py`: script reproducible de entrenamiento.
- `data/loan_approval_dataset.csv`: dataset usado para generar el modelo.

## Instrucción importante para integración

El backend del repo principal debe llamar a este servicio por HTTP.

No intentar cargar el `.joblib` desde Node.js.

## Endpoint recomendado

`POST /recommend`

Input:

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

Output:

```json
{
  "threshold": 0.55,
  "maxTotalBurden": 0.4,
  "recommendation": {},
  "alternatives": [],
  "discardedSummary": {}
}
```

## Plazos

El frontend debe trabajar en meses.

El modelo fue entrenado con `loan_term` en años, por lo que el servicio convierte internamente:

```text
loan_term = termMonths / 12
```

## Regla de deuda

El servicio descarta escenarios donde:

```text
(currentDebtMonthly + monthlyPayment) / monthlyIncome > maxTotalBurden
```

Valor por defecto:

```text
maxTotalBurden = 0.40
```

## Ranking de escenarios

1. Mayor monto viable.
2. Mayor probabilidad del modelo.
3. Menor carga financiera total.
4. Menor plazo.

## Advertencia funcional

Si no existen escenarios que pasen todos los filtros, el servicio retorna `recommendation: null` y entrega `bestScenarioWithinDebtFilter` como ayuda diagnóstica.
