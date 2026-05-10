"""
Pruebas unitarias – Endpoint: POST /api/applications
HU asociada: Solicitud de préstamo de consumo con evaluación crediticia automática.

Casos de prueba:
  Caso 1 – dataConsent: true  + monto bajo  → 201, decision: "pre-approved"
  Caso 2 – dataConsent: false + mismos datos → 201, decision: "referred"

Ejecutar (con la API levantada en localhost:3000):
  python -m pytest test_applications.py -v
  # o bien:
  python -m unittest test_applications.py -v
"""

import unittest
import requests

BASE_URL = "http://localhost:3000"
ENDPOINT = f"{BASE_URL}/api/applications"


class TestApplicationsEndpoint(unittest.TestCase):
    """
    Clase de prueba para POST /api/applications.
    setUpClass prepara el payload base que se reutiliza en ambos casos.
    tearDownClass puede usarse para limpiar datos persistidos si fuera necesario.
    """

    @classmethod
    def setUpClass(cls):
        """Datos de prueba compartidos por todos los métodos de esta clase."""
        # Monto bajo (ej. 100 000 CLP) para que el DTI resulte pequeño
        # y el score supere 620, garantizando que dataConsent sea el factor
        # determinante de la decisión.
        cls.base_payload = {
            "identification": "12345678-9",
            "fullName":        "María González",
            "email":           "maria.gonzalez@test.cl",
            "phone":           "+56912345678",
            "monthlyIncome":   1_500_000,   # ingreso mensual en CLP
            "employmentStatus":"employed",
            "amount":          100_000,     # monto bajo → DTI pequeño → score alto
            "termMonths":      12,
            "interestRate":    1.5,
        }

    @classmethod
    def tearDownClass(cls):
        """
        Limpieza post-suite. En este stub la API no persiste en DB,
        por lo que no se requiere acción; se deja como buena práctica.
        """
        pass

    # ------------------------------------------------------------------
    # Caso 1
    # Input:          base_payload + dataConsent: true
    # Salida esperada: HTTP 201, body.decision == "pre-approved"
    # Contexto:       Score > 620 Y consentimiento de datos otorgado
    #                 → aprobación preliminar.
    # ------------------------------------------------------------------
    def test_caso1_pre_approved_con_dataConsent_true(self):
        """Caso 1: dataConsent=True + monto bajo → decision pre-approved (201)."""
        payload = {**self.base_payload, "dataConsent": True}

        response = requests.post(ENDPOINT, json=payload, timeout=10)

        # Verificar status HTTP
        self.assertEqual(
            response.status_code, 201,
            msg=f"Se esperaba 201, se obtuvo {response.status_code}. "
                f"Body: {response.text}"
        )

        body = response.json()

        # Verificar campos mínimos presentes
        self.assertIn("applicationId", body, "Falta campo 'applicationId' en la respuesta")
        self.assertIn("decision",       body, "Falta campo 'decision' en la respuesta")
        self.assertIn("score",          body, "Falta campo 'score' en la respuesta")

        # Verificar decisión esperada
        self.assertEqual(
            body["decision"], "pre-approved",
            msg=f"Se esperaba decision='pre-approved', se obtuvo '{body.get('decision')}'"
        )

    # ------------------------------------------------------------------
    # Caso 2
    # Input:          mismos datos + dataConsent: false
    # Salida esperada: HTTP 201, body.decision == "referred"
    # Contexto:       Score > 620 PERO sin consentimiento de datos →
    #                 la lógica obliga a derivar a revisión manual.
    # ------------------------------------------------------------------
    def test_caso2_referred_con_dataConsent_false(self):
        """Caso 2: dataConsent=False + mismos datos → decision referred (201)."""
        payload = {**self.base_payload, "dataConsent": False}

        response = requests.post(ENDPOINT, json=payload, timeout=10)

        # Verificar status HTTP
        self.assertEqual(
            response.status_code, 201,
            msg=f"Se esperaba 201, se obtuvo {response.status_code}. "
                f"Body: {response.text}"
        )

        body = response.json()

        self.assertIn("decision", body, "Falta campo 'decision' en la respuesta")

        # Verificar decisión esperada
        self.assertEqual(
            body["decision"], "referred",
            msg=f"Se esperaba decision='referred', se obtuvo '{body.get('decision')}'"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
