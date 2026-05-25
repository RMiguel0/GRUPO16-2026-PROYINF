# Model Card - Random Forest Recommender

## Uso previsto

Modelo auxiliar para rankear escenarios de monto/plazo en un recomendador de crédito de consumo.

No está diseñado para aprobar o rechazar solicitudes reales.

## Target de entrenamiento

`loan_status`

- `0`: Rejected
- `1`: Approved

## Modelo

`RandomForestClassifier`

Parámetros:

```json
{
  "n_estimators": 100,
  "max_depth": 10,
  "class_weight": "balanced",
  "random_state": 25
}
```

## Umbral operativo

`0.55` sobre `P(clase 1 = Approved)`.

## Limitaciones

El modelo fue entrenado con un dataset público y solo con variables disponibles para el proyecto:

- dependientes
- situación laboral
- ingreso
- monto
- plazo
- variables derivadas financieras

No usa variables fuertes del dataset original como `cibil_score` o activos patrimoniales, porque no estarán disponibles en el flujo objetivo.

Por eso debe usarse como una señal auxiliar y no como decisión final.
