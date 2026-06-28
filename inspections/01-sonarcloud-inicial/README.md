# Inspeccion inicial SonarCloud

## Datos generales

- Herramienta: SonarCloud
- Seccion inspeccionada: `backend/src/routes/ocr.routes.js`
- Motivo de seleccion: modulo asociado al OCR y procesamiento de documentos del usuario.

## Evidencia

Placeholders para capturas:

- `resumen-sonarcloud.png`
- `issue-01.png`
- `issue-02.png`

## Issue 1

- Mensaje: "Extract this nested ternary operation into an independent statement."
- Archivo: `backend/src/routes/ocr.routes.js`
- Linea aproximada: 21
- Tipo: Code Smell
- Severidad: Major
- Categoria: Maintainability / Medium
- Descripcion: el ternario anidado dificulta la lectura de la logica de calculo del digito verificador del RUT.
- Recomendacion: extraer la logica a una sentencia independiente o funcion auxiliar.
- Decision del equipo: aceptada.
- Forma de abordaje: crear logica explicita para calcular el digito verificador sin ternario anidado.

## Issue 2

- Mensaje: "Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking."
- Archivo: `backend/src/routes/ocr.routes.js`
- Linea aproximada: 78
- Tipo: Code Smell
- Severidad: Major
- Categoria: Reliability / Medium / Performance
- Descripcion: la expresion regular usada para formatear el RUT puede tener problemas de rendimiento por backtracking.
- Recomendacion: reemplazar la expresion regular por una implementacion mas simple y predecible.
- Decision del equipo: aceptada.
- Forma de abordaje: crear una funcion auxiliar para insertar puntos en el cuerpo del RUT de forma iterativa o mediante slicing.
