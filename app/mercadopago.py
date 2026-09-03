"""Mercado Pago Pix donations polled without webhooks.

The Access Token is deliberately kept in server memory. Browser clients only
receive a sanitized status and the public Pix QR image for the current order.
"""

from __future__ import annotations

import asyncio
import base64
import io
import re
import uuid
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Awaitable, Callable

import httpx
import qrcode


Broadcast = Callable[[dict[str, Any]], Awaitable[None]]
ClientFactory = Callable[[], httpx.AsyncClient]

APPROVED_STATUSES = {"approved", "processed", "accredited"}
RENEWABLE_STATUSES = {"cancelled", "canceled", "expired", "rejected", "refunded"}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def money_text(value: Decimal | float | str) -> str:
    """Returns the exact two-decimal representation expected by Orders API."""
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as error:
        raise ValueError("Informe um valor de doação válido.") from error
    if amount < Decimal("0.01") or amount > Decimal("1000000.00"):
        raise ValueError("O valor da doação deve ficar entre R$ 0,01 e R$ 1.000.000,00.")
    return format(amount, ".2f")


def qr_png_base64(payload: str) -> str:
    """Builds a QR image when Mercado Pago returns only the Pix copy/paste code."""
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def first_payment(order: dict[str, Any]) -> dict[str, Any]:
    transactions = order.get("transactions") or {}
    payments = transactions.get("payments") if isinstance(transactions, dict) else None
    if isinstance(payments, list) and payments and isinstance(payments[0], dict):
        return payments[0]
    if "payment_method_id" in order or "transaction_amount" in order:
        return order
    return {}


def order_statuses(order: dict[str, Any]) -> set[str]:
    payment = first_payment(order)
    return {
        str(value).strip().lower()
        for value in (order.get("status"), order.get("status_detail"), payment.get("status"), payment.get("status_detail"))
        if value
    }


def payer_display_name(order: dict[str, Any]) -> str:
    payment = first_payment(order)
    candidates = [payment.get("payer"), order.get("payer")]
    for payer in candidates:
        if not isinstance(payer, dict):
            continue
        first_name = str(payer.get("first_name") or "").strip()
        last_name = str(payer.get("last_name") or "").strip()
        name = " ".join(part for part in (first_name, last_name) if part)
        if name and first_name.upper() != "APRO":
            return " ".join(name.split())[:32]
    return "Apoiador via Pix"


@dataclass(slots=True)
class PixCharge:
    charge_id: str
    resource_kind: str
    amount: str
    qr_code: str
    qr_code_base64: str
    status: str
    expires_at: datetime


class MercadoPagoDonationController:
    """Creates one Pix order at a time and renews it after payment or expiry."""

    api_base = "https://api.mercadopago.com"

    def __init__(
        self,
        broadcast: Broadcast,
        *,
        poll_interval: float = 5.0,
        client_factory: ClientFactory | None = None,
    ) -> None:
        self.broadcast = broadcast
        self.poll_interval = max(1.0, poll_interval)
        self.client_factory = client_factory or (lambda: httpx.AsyncClient(timeout=12, follow_redirects=False))
        self.last_error: str | None = None
        self._access_token: str | None = None
        self._amount = "0.00"
        self._payer_email = ""
        self._expiration_minutes = 30
        self._charge: PixCharge | None = None
        self._task: asyncio.Task[None] | None = None
        self._pending_idempotency_key: str | None = None

    @property
    def configured(self) -> bool:
        return bool(self._access_token)

    def status(self) -> dict[str, Any]:
        charge = self._charge
        task_active = self._task is not None and not self._task.done()
        return {
            "mercado_pago_configured": self.configured,
            "mercado_pago_active": self.configured and (task_active or charge is not None),
            "mercado_pago_has_qr": charge is not None and bool(charge.qr_code_base64),
            "mercado_pago_charge_id": charge.charge_id if charge else None,
            "mercado_pago_order_status": charge.status if charge else None,
            "mercado_pago_amount": float(charge.amount if charge else self._amount),
            "mercado_pago_expires_at": charge.expires_at.isoformat() if charge else None,
            "mercado_pago_poll_interval": self.poll_interval,
            "mercado_pago_error": self.last_error,
        }

    def public_qr(self) -> dict[str, Any]:
        charge = self._charge
        if not charge:
            return {"enabled": False, "qr_code_base64": None}
        return {
            "enabled": True,
            "charge_id": charge.charge_id,
            "amount": float(charge.amount),
            "currency": "BRL",
            "expires_at": charge.expires_at.isoformat(),
            "qr_code_base64": charge.qr_code_base64,
        }

    async def configure(
        self,
        access_token: str,
        amount: Decimal | float | str,
        payer_email: str,
        expiration_minutes: int = 30,
    ) -> None:
        token = access_token.strip()
        email = payer_email.strip()
        if len(token) < 20:
            raise ValueError("Informe um Access Token válido do Mercado Pago.")
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Informe um e-mail válido para criar a cobrança Pix.")
        if not 30 <= expiration_minutes <= 1440:
            raise ValueError("A validade da cobrança deve ficar entre 30 minutos e 24 horas.")
        amount_text = money_text(amount)

        await self.stop()
        self._access_token = token
        self._amount = amount_text
        self._payer_email = email
        self._expiration_minutes = expiration_minutes
        self.last_error = None
        try:
            await self._create_charge()
        except Exception as error:
            self._access_token = None
            self._charge = None
            self.last_error = str(error)
            raise
        self._task = asyncio.create_task(self._run(), name="mercado-pago-pix-polling")

    async def stop(self) -> None:
        task = self._task
        self._task = None
        if task and task is not asyncio.current_task() and not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        self._access_token = None
        self._payer_email = ""
        self._charge = None
        self._pending_idempotency_key = None
        self.last_error = None

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self._access_token:
            raise RuntimeError("Configure o Mercado Pago antes de gerar uma cobrança.")
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._access_token}",
        }
        headers.update(kwargs.pop("headers", {}))
        try:
            async with self.client_factory() as client:
                response = await client.request(method, f"{self.api_base}{path}", headers=headers, **kwargs)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as error:
            status_code = error.response.status_code
            if status_code in {401, 403}:
                message = "O Mercado Pago recusou o Access Token. Confira se ele está completo e ativo."
            elif status_code == 429:
                message = "O Mercado Pago limitou as consultas temporariamente. Aguarde alguns segundos."
            elif 400 <= status_code < 500:
                message = "O Mercado Pago recusou a cobrança. Confira o token, o e-mail e o valor informado."
            else:
                message = "O Mercado Pago está temporariamente indisponível."
            raise RuntimeError(message) from error
        except httpx.HTTPError as error:
            raise RuntimeError("Não foi possível acessar o Mercado Pago. Verifique a internet e tente novamente.") from error
        except ValueError as error:
            raise RuntimeError("O Mercado Pago devolveu uma resposta inválida.") from error
        if not isinstance(payload, dict):
            raise RuntimeError("O Mercado Pago devolveu uma resposta inválida.")
        return payload

    async def _create_order_charge(self, idempotency_key: str) -> tuple[dict[str, Any], str, str, str]:
        """Creates a Pix through the current Orders API."""
        external_reference = f"live-gamer-{uuid.uuid4().hex}"
        payload = {
            "type": "online",
            "total_amount": self._amount,
            "external_reference": external_reference,
            "processing_mode": "automatic",
            "transactions": {
                "payments": [
                    {
                        "amount": self._amount,
                        "payment_method": {"id": "pix", "type": "bank_transfer"},
                        "expiration_time": f"PT{self._expiration_minutes}M",
                    }
                ]
            },
            "payer": {"email": self._payer_email},
        }
        order = await self._request(
            "POST",
            "/v1/orders",
            headers={"Content-Type": "application/json", "X-Idempotency-Key": idempotency_key},
            json=payload,
        )
        payment = first_payment(order)
        payment_method = payment.get("payment_method") if isinstance(payment.get("payment_method"), dict) else {}
        return order, str(order.get("id") or "").strip(), str(payment_method.get("qr_code") or "").strip(), str(payment_method.get("qr_code_base64") or "").strip()

    async def _create_legacy_payment_charge(self, idempotency_key: str) -> tuple[dict[str, Any], str, str, str]:
        """Supports older TEST credentials that predate Orders API."""
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self._expiration_minutes)
        payload: dict[str, Any] = {
            "transaction_amount": float(self._amount),
            "description": "Doação Live Gamer 3D",
            "payment_method_id": "pix",
            "date_of_expiration": expires_at.isoformat(timespec="milliseconds"),
            "external_reference": f"live-gamer-{uuid.uuid4().hex}",
            "payer": {"email": self._payer_email},
        }
        if self._access_token and self._access_token.startswith("TEST-"):
            payload["payer"]["first_name"] = "APRO"
        payment = await self._request(
            "POST",
            "/v1/payments",
            headers={"Content-Type": "application/json", "X-Idempotency-Key": idempotency_key},
            json=payload,
        )
        transaction_data = ((payment.get("point_of_interaction") or {}).get("transaction_data") or {})
        return payment, str(payment.get("id") or "").strip(), str(transaction_data.get("qr_code") or "").strip(), str(transaction_data.get("qr_code_base64") or "").strip()

    async def _create_charge(self) -> PixCharge:
        idempotency_key = self._pending_idempotency_key or str(uuid.uuid4())
        self._pending_idempotency_key = idempotency_key
        resource_kind = "payments" if self._access_token and self._access_token.startswith("TEST-") else "orders"
        if resource_kind == "payments":
            resource, charge_id, qr_code, qr_base64 = await self._create_legacy_payment_charge(idempotency_key)
        else:
            resource, charge_id, qr_code, qr_base64 = await self._create_order_charge(idempotency_key)
        if "," in qr_base64 and qr_base64.lower().startswith("data:image"):
            qr_base64 = qr_base64.split(",", 1)[1]
        if qr_code:
            qr_base64 = qr_png_base64(qr_code)
        if not charge_id or not qr_base64:
            raise RuntimeError("O Mercado Pago não devolveu um QR Code Pix para esta cobrança.")
        payment = first_payment(resource)
        status_values = order_statuses(resource)
        initial_status = str(resource.get("status") or payment.get("status") or "created").strip().lower()
        charge = PixCharge(
            charge_id=charge_id,
            resource_kind=resource_kind,
            amount=money_text(payment.get("transaction_amount") or payment.get("amount") or resource.get("total_amount") or self._amount),
            qr_code=qr_code,
            qr_code_base64=qr_base64,
            status=initial_status if initial_status else next(iter(status_values), "created"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=self._expiration_minutes),
        )
        self._charge = charge
        self._pending_idempotency_key = None
        self.last_error = None
        return charge

    async def _poll_once(self) -> None:
        if not self._charge:
            await self._create_charge()
            await self._broadcast_status()
            return
        charge = self._charge
        resource = await self._request("GET", f"/v1/{charge.resource_kind}/{charge.charge_id}")
        statuses = order_statuses(resource)
        payment = first_payment(resource)
        previous_status = charge.status
        if statuses:
            charge.status = sorted(statuses)[0]
        self.last_error = None

        if statuses & APPROVED_STATUSES:
            donation = {
                "donor_name": payer_display_name(resource),
                "amount": float(money_text(payment.get("transaction_amount") or payment.get("amount") or resource.get("total_amount") or charge.amount)),
                "currency": "BRL",
                "message": "Doação recebida via Pix",
            }
            self._charge = None
            await self.broadcast({"type": "donation", "data": donation})
            await self._create_charge()
            await self._broadcast_status()
            return

        expired_locally = datetime.now(timezone.utc) >= charge.expires_at
        if statuses & RENEWABLE_STATUSES or expired_locally:
            self._charge = None
            await self._create_charge()
            await self._broadcast_status()
            return

        if charge.status != previous_status:
            await self._broadcast_status()

    async def _broadcast_status(self) -> None:
        await self.broadcast({"type": "mercado_pago", "data": self.status()})

    async def _run(self) -> None:
        try:
            while self.configured:
                await asyncio.sleep(self.poll_interval)
                try:
                    await self._poll_once()
                except asyncio.CancelledError:
                    raise
                except RuntimeError as error:
                    next_error = str(error)
                    changed = next_error != self.last_error
                    self.last_error = next_error
                    if changed:
                        await self._broadcast_status()
                except Exception:
                    next_error = "Não foi possível atualizar a cobrança Pix agora."
                    changed = next_error != self.last_error
                    self.last_error = next_error
                    if changed:
                        await self._broadcast_status()
        except asyncio.CancelledError:
            pass
