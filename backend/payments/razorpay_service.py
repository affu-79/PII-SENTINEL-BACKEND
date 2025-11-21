"""Razorpay integration helpers for order creation and webhook validation."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

try:
    import razorpay  # type: ignore
    from razorpay.errors import SignatureVerificationError  # type: ignore
except ImportError:  # pragma: no cover - handled gracefully
    razorpay = None

    class SignatureVerificationError(Exception):
        """Fallback when razorpay package is unavailable."""

logger = logging.getLogger(__name__)


class RazorpayNotConfigured(RuntimeError):
    """Raised when Razorpay credentials are missing."""


class RazorpaySignatureError(RuntimeError):
    """Raised when webhook signature verification fails."""


@dataclass(frozen=True)
class RazorpayOrderDetails:
    order_id: str
    amount: int
    currency: str
    key: str
    notes: Dict[str, Any]


class RazorpayService:
    """Wrapper around Razorpay SDK to simplify backend usage."""

    def __init__(self, key_id: Optional[str], key_secret: Optional[str], webhook_secret: Optional[str]):
        self.key_id = (key_id or '').strip()
        self.key_secret = (key_secret or '').strip()
        self.webhook_secret = (webhook_secret or '').strip()
        self._client = None

        if razorpay is None:
            logger.warning("Razorpay SDK not installed. Payment flows disabled.")
            return

        if self.key_id and self.key_secret:
            self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
            # Optional but useful for Razorpay dashboard analytics
            try:
                self._client.set_app_details({
                    "title": "PII Sentinel Backend",
                    "version": os.getenv('APP_VERSION', 'unknown')
                })
            except Exception:  # pragma: no cover
                logger.debug("Unable to set Razorpay app details", exc_info=True)
        else:
            logger.warning("Razorpay credentials not provided. Payment flows disabled.")

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @classmethod
    def from_env(cls) -> "RazorpayService":
        return cls(
            os.getenv('RAZORPAY_KEY_ID'),
            os.getenv('RAZORPAY_KEY_SECRET'),
            os.getenv('RAZORPAY_WEBHOOK_SECRET')
        )

    def create_order(self, *, amount_inr: float, receipt: str, notes: Optional[Dict[str, Any]] = None, currency: str = 'INR') -> RazorpayOrderDetails:
        if not self.enabled:
            raise RazorpayNotConfigured("Razorpay client not configured")

        amount_paise = int(round(amount_inr * 100))
        payload = {
            'amount': amount_paise,
            'currency': currency,
            'receipt': receipt,
            'payment_capture': 1,
            'notes': notes or {}
        }
        logger.info("Creating Razorpay order", extra={'payload': payload})
        order = self._client.order.create(payload)
        logger.info("Razorpay order created", extra={'order_id': order.get('id'), 'amount': order.get('amount')})
        return RazorpayOrderDetails(
            order_id=order['id'],
            amount=order['amount'],
            currency=order['currency'],
            key=self.key_id,
            notes=order.get('notes', {})
        )

    def verify_webhook(self, body: bytes, signature: Optional[str]) -> Dict[str, Any]:
        if not self.enabled:
            raise RazorpayNotConfigured("Razorpay client not configured")
        if not self.webhook_secret:
            raise RazorpayNotConfigured("Razorpay webhook secret not configured")
        if not signature:
            raise RazorpaySignatureError("Missing webhook signature header")

        payload = body.decode('utf-8') if isinstance(body, (bytes, bytearray)) else str(body)
        try:
            razorpay.Utility.verify_webhook_signature(payload, signature, self.webhook_secret)
        except SignatureVerificationError as exc:
            logger.warning("Razorpay webhook signature verification failed", exc_info=True)
            raise RazorpaySignatureError(str(exc)) from exc

        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON in Razorpay webhook payload", exc_info=True)
            raise RazorpaySignatureError("Invalid webhook payload") from exc
