import base64
import json
import unittest
from unittest.mock import AsyncMock

import httpx

from app.mercadopago import MercadoPagoDonationController


def pending_order(order_id: str, amount: str = "5.00") -> dict:
    return {
        "id": order_id,
        "status": "action_required",
        "total_amount": amount,
        "transactions": {
            "payments": [
                {
                    "amount": amount,
                    "status": "action_required",
                    "status_detail": "waiting_transfer",
                    "payment_method": {
                        "id": "pix",
                        "type": "bank_transfer",
                        "qr_code": f"PIX-CODE-{order_id}",
                        "qr_code_base64": "",
                    },
                }
            ]
        },
    }


class MercadoPagoDonationControllerTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_test_credential_uses_payments_api_compatibility(self):
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(201, json={
                "id": 123456,
                "status": "pending",
                "transaction_amount": 10.0,
                "payment_method_id": "pix",
                "point_of_interaction": {
                    "transaction_data": {
                        "qr_code": "PIX-LEGACY-CODE",
                        "qr_code_base64": "",
                    }
                },
                "payer": {"email": "buyer@example.com", "first_name": "APRO"},
            })

        transport = httpx.MockTransport(handler)
        controller = MercadoPagoDonationController(
            AsyncMock(),
            poll_interval=60,
            client_factory=lambda: httpx.AsyncClient(transport=transport),
        )
        try:
            await controller.configure("TEST-" + "x" * 40, 10, "buyer@example.com")
            payload = json.loads(requests[0].content)

            self.assertEqual(requests[0].url.path, "/v1/payments")
            self.assertEqual(payload["payment_method_id"], "pix")
            self.assertEqual(payload["payer"]["first_name"], "APRO")
            self.assertIn("date_of_expiration", payload)
            self.assertEqual(controller._charge.resource_kind, "payments")
            self.assertEqual(controller.status()["mercado_pago_charge_id"], "123456")
        finally:
            await controller.stop()

    async def test_creates_a_pix_order_with_idempotency_and_never_exposes_the_token(self):
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(201, json=pending_order("order-1"))

        transport = httpx.MockTransport(handler)
        controller = MercadoPagoDonationController(
            AsyncMock(),
            poll_interval=60,
            client_factory=lambda: httpx.AsyncClient(transport=transport),
        )
        token = "APP_USR-" + "x" * 40
        try:
            await controller.configure(token, "5", "live@example.com", 30)
            request = requests[0]
            payload = json.loads(request.content)

            self.assertEqual(request.method, "POST")
            self.assertEqual(request.url.path, "/v1/orders")
            self.assertEqual(request.headers["authorization"], f"Bearer {token}")
            self.assertTrue(request.headers["x-idempotency-key"])
            self.assertEqual(payload["processing_mode"], "automatic")
            self.assertEqual(payload["transactions"]["payments"][0]["payment_method"]["id"], "pix")
            self.assertEqual(payload["transactions"]["payments"][0]["expiration_time"], "PT30M")
            self.assertNotIn(token, repr(controller.status()))
            self.assertNotIn(token, repr(controller.public_qr()))
            self.assertTrue(controller.public_qr()["enabled"])
            self.assertTrue(base64.b64decode(controller.public_qr()["qr_code_base64"]).startswith(b"\x89PNG"))
        finally:
            await controller.stop()

    async def test_approved_payment_emits_existing_donation_event_and_rotates_the_qr(self):
        post_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal post_count
            if request.method == "POST":
                post_count += 1
                return httpx.Response(201, json=pending_order(f"order-{post_count}", "12.50"))
            paid = pending_order("order-1", "12.50")
            paid["status"] = "processed"
            paid["transactions"]["payments"][0]["status"] = "processed"
            paid["transactions"]["payments"][0]["status_detail"] = "accredited"
            paid["transactions"]["payments"][0]["payer"] = {"first_name": "Ana", "last_name": "Gamer"}
            return httpx.Response(200, json=paid)

        broadcast = AsyncMock()
        transport = httpx.MockTransport(handler)
        controller = MercadoPagoDonationController(
            broadcast,
            poll_interval=60,
            client_factory=lambda: httpx.AsyncClient(transport=transport),
        )
        try:
            await controller.configure("APP_USR-" + "x" * 40, 12.5, "live@example.com")
            await controller._poll_once()

            donation_events = [call.args[0] for call in broadcast.await_args_list if call.args[0]["type"] == "donation"]
            self.assertEqual(len(donation_events), 1)
            self.assertEqual(donation_events[0]["data"]["donor_name"], "Ana Gamer")
            self.assertEqual(donation_events[0]["data"]["amount"], 12.5)
            self.assertEqual(controller.status()["mercado_pago_charge_id"], "order-2")
            self.assertEqual(post_count, 2)
        finally:
            await controller.stop()

    async def test_expired_order_rotates_without_emitting_a_donation(self):
        post_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal post_count
            if request.method == "POST":
                post_count += 1
                return httpx.Response(201, json=pending_order(f"order-{post_count}"))
            expired = pending_order("order-1")
            expired["status"] = "expired"
            expired["transactions"]["payments"][0]["status"] = "expired"
            return httpx.Response(200, json=expired)

        broadcast = AsyncMock()
        transport = httpx.MockTransport(handler)
        controller = MercadoPagoDonationController(
            broadcast,
            poll_interval=60,
            client_factory=lambda: httpx.AsyncClient(transport=transport),
        )
        try:
            await controller.configure("APP_USR-" + "x" * 40, 5, "live@example.com")
            await controller._poll_once()

            self.assertFalse(any(call.args[0]["type"] == "donation" for call in broadcast.await_args_list))
            self.assertEqual(controller.status()["mercado_pago_charge_id"], "order-2")
        finally:
            await controller.stop()

    async def test_rejected_access_token_has_a_safe_error_message(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"message": "unauthorized"})

        controller = MercadoPagoDonationController(
            AsyncMock(),
            poll_interval=60,
            client_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
        token = "APP_USR-" + "x" * 40

        with self.assertRaisesRegex(RuntimeError, "recusou o Access Token") as caught:
            await controller.configure(token, 5, "live@example.com")

        self.assertNotIn(token, str(caught.exception))
        self.assertFalse(controller.status()["mercado_pago_configured"])


if __name__ == "__main__":
    unittest.main()
