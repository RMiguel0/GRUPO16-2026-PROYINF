"""
Pruebas unitarias – Endpoint: POST /api/otp/verify
HU asociada: Verificación de identidad mediante código OTP enviado al correo
             del solicitante antes de firmar o confirmar un préstamo.

Casos de prueba:
  Caso 3 – Solo email, sin code  → 400, error: "missing_params"
  Caso 4 – Email sin OTP activo + código cualquiera → 404, error: "not_found"

Ejecutar (con la API levantada en localhost:3000):
  python -m pytest test_otp_verify.py -v
  # o bien:
  python -m unittest test_otp_verify.py -v
"""

import unittest
import requests

BASE_URL = "http://localhost:3000"
ENDPOINT = f"{BASE_URL}/api/otp/verify"


class TestOtpVerifyEndpoint(unittest.TestCase):
    """
    Clase de prueba para POST /api/otp/verify.
    setUpClass define los datos de prueba comunes.
    tearDownClass es no-op porque el OTP store es en memoria y no requiere
    limpieza explícita.
    """

    @classmethod
    def setUpClass(cls):
        """
        Datos de prueba compartidos.
        Se usa un email que con certeza NO tiene OTP generado
        (nunca se llamó a /api/otp/send para este email en la suite).
        """
        cls.email_sin_otp   = "sin-otp-registrado@test.cl"
        cls.codigo_cualquiera = "999999"

    @classmethod
    def tearDownClass(cls):
        """No se requiere limpieza: el store de OTPs vive en memoria."""
        pass

    # ------------------------------------------------------------------
    # Caso 3
    # Input:          { email: "..." }  →  sin campo "code"
    # Salida esperada: HTTP 400, body.error == "missing_params"
    # Contexto:       Validación de parámetros obligatorios; el endpoint
    #                 debe rechazar requests incompletos antes de consultar
    #                 el store de OTPs.
    # ------------------------------------------------------------------
    def test_caso3_error_missing_params_sin_code(self):
        """Caso 3: solo email enviado, sin code → 400 missing_params."""
        payload = {"email": self.email_sin_otp}   # falta "code"

        response = requests.post(ENDPOINT, json=payload, timeout=10)

        # Verificar status HTTP
        self.assertEqual(
            response.status_code, 400,
            msg=f"Se esperaba 400, se obtuvo {response.status_code}. "
                f"Body: {response.text}"
        )

        body = response.json()

        self.assertIn("error", body, "Falta campo 'error' en la respuesta")

        # Verificar código de error
        self.assertEqual(
            body["error"], "missing_params",
            msg=f"Se esperaba error='missing_params', se obtuvo '{body.get('error')}'"
        )

        # Verificar que success sea False
        self.assertFalse(
            body.get("success", True),
            msg="Se esperaba success=false en respuesta de error"
        )

    # ------------------------------------------------------------------
    # Caso 4
    # Input:          { email: "sin-otp@test.cl", code: "999999" }
    # Salida esperada: HTTP 404, body.error == "not_found"
    # Contexto:       El email nunca pasó por /api/otp/send, por lo que
    #                 no existe entrada en el store → not_found.
    #                 Clase de equivalencia: email válido pero sin OTP activo.
    # ------------------------------------------------------------------
    def test_caso4_error_not_found_email_sin_otp(self):
        """Caso 4: email sin OTP registrado + código cualquiera → 404 not_found."""
        payload = {
            "email": self.email_sin_otp,
            "code":  self.codigo_cualquiera,
        }

        response = requests.post(ENDPOINT, json=payload, timeout=10)

        # Verificar status HTTP
        self.assertEqual(
            response.status_code, 404,
            msg=f"Se esperaba 404, se obtuvo {response.status_code}. "
                f"Body: {response.text}"
        )

        body = response.json()

        self.assertIn("error", body, "Falta campo 'error' en la respuesta")

        # Verificar código de error
        self.assertEqual(
            body["error"], "not_found",
            msg=f"Se esperaba error='not_found', se obtuvo '{body.get('error')}'"
        )

        # Verificar que success sea False
        self.assertFalse(
            body.get("success", True),
            msg="Se esperaba success=false en respuesta de error"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
