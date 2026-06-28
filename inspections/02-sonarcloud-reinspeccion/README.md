# Re-inspeccion SonarCloud

## Estado

La re-inspeccion en SonarCloud debe ejecutarse despues de aplicar las correcciones en `backend/src/routes/ocr.routes.js`.

Este documento queda preparado para registrar el resultado real de SonarCloud. No se afirma que los issues fueron resueltos hasta ejecutar la re-inspeccion.

## Correcciones aplicadas

- Se reemplazo el ternario anidado del calculo del digito verificador del RUT por la funcion auxiliar `calculateRutDv`.
- Se reemplazo la expresion regular usada para formatear el cuerpo del RUT por la funcion auxiliar `formatRutBody`, que inserta puntos cada tres digitos desde la derecha usando slicing.

## Evidencia pendiente

Placeholder para captura:

- `resultado-reinspeccion.png`

## Resultado de re-inspeccion

Pendiente de completar despues de ejecutar SonarCloud nuevamente.
