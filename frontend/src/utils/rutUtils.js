/**
 * Utilidades para validar y normalizar el RUT chileno.
 * Estas funciones permiten comprobar si un RUT ingresado es válido
 * según el algoritmo del dígito verificador (módulo 11).
 */

/**
 * Normaliza un RUT eliminando puntos y espacios y forzando mayúsculas.
 * @param {string} rut - El RUT en formato libre (con puntos o guiones).
 * @returns {string} El RUT normalizado, con formato 12345678-9 o K.
 */
export function normalizarRUT(rut) {
  const limpio = (rut || "").trim().replace(/[.\s-]/g, "").toUpperCase();
  if (limpio.length < 2) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!/^[0-9]{7,8}$/.test(cuerpo) || !/^[0-9K]$/.test(dv)) {
    return limpio;
  }

  return `${cuerpo}-${dv}`;
}

/**
 * Valida que un RUT chileno sea correcto mediante el algoritmo módulo 11.
 * @param {string} rutCompleto - RUT completo con dígito verificador (ej: 12345678-9).
 * @returns {boolean} true si el RUT es válido, false en caso contrario.
 */
export function validarRUT(rutCompleto) {
  const clean = normalizarRUT(rutCompleto);
  // Debe contener dígito verificador separado por guion
  const match = /^([0-9]{7,8})-([0-9K])$/.exec(clean);
  if (!match) return false;
  const cuerpo = match[1];
  const dvIngresado = match[2];
  let suma = 0;
  let multiplo = 2;
  // Recorre el cuerpo desde el último dígito hacia atrás
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += multiplo * parseInt(cuerpo[i], 10);
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = suma % 11;
  const dvEsperado = 11 - resto;
  const dvCalculado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();
  return dvCalculado === dvIngresado;
}
