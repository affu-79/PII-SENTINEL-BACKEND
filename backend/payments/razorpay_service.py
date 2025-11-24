"""Razorpay integration for order creation and payment verification."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

try:
    import razorpay  # type: ignore
except ImportError:  # pragma: no cover - handled gracefully
    razorpay = None

logger = logging.getLogger(__name__)


class RazorpayNotConfigured(RuntimeError):
    """Raised when Razorpay credentials are missing."""


@dataclass(frozen=True)
class RazorpayOrderDetails:
    order_id: str
    amount: int
    currency: str
    key: str
    notes: Dict[str, Any]


class RazorpayService:
    """
    Wrapper around Razorpay SDK for payment processing.
    
    Usage:
    1. Create order using create_order()
    2. Pass order details to frontend
    3. Frontend completes payment with Razorpay Checkout
    4. Verify payment signature on callback using verify_payment_signature()
    
    Configuration:
    - Set RAZORPAY_KEY_ID (your live key: rzp_live_xxxxx)
    - Set RAZORPAY_KEY_SECRET (your live secret)
    
    ⚠️ IMPORTANT: Use LIVE keys for production, TEST keys for development
    """

    def __init__(self, key_id: Optional[str], key_secret: Optional[str]):
        self.key_id = (key_id or '').strip()
        self.key_secret = (key_secret or '').strip()
        self._client = None

        if razorpay is None:
            logger.warning("Razorpay SDK not installed. Run: pip install razorpay")
            return

        if self.key_id and self.key_secret:
            # Validate key format
            if self.key_id.startswith('rzp_test_'):
                logger.warning("⚠️  Using Razorpay TEST key. Switch to LIVE key (rzp_live_xxxxx) for production!")
            elif self.key_id.startswith('rzp_live_'):
                logger.info("✓ Using Razorpay LIVE key - Ready for production payments")
            else:
                logger.warning("⚠️  Razorpay key format not recognized. Expected: rzp_live_xxxxx or rzp_test_xxxxx")
            
            self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
            
            # Optional: Set app details for Razorpay dashboard analytics
            try:
                self._client.set_app_details({
                    "title": "PII Sentinel",
                    "version": os.getenv('APP_VERSION', '1.0.0')
                })
            except Exception:
                logger.debug("Unable to set Razorpay app details", exc_info=True)
        else:
            logger.warning("Razorpay credentials not provided. Payment flows disabled.")

    @property
    def enabled(self) -> bool:
        """Check if Razorpay is properly configured and ready."""
        return self._client is not None

    @classmethod
    def from_env(cls) -> "RazorpayService":
        """
        Create RazorpayService from environment variables.
        
        Required environment variables:
        - RAZORPAY_KEY_ID: Your Razorpay key (rzp_live_xxxxx for production)
        - RAZORPAY_KEY_SECRET: Your Razorpay secret
        """
        return cls(
            os.getenv('RAZORPAY_KEY_ID'),
            os.getenv('RAZORPAY_KEY_SECRET')
        )

    def create_order(
        self, 
        *, 
        amount_inr: float, 
        receipt: str, 
        notes: Optional[Dict[str, Any]] = None, 
        currency: str = 'INR'
    ) -> RazorpayOrderDetails:
        """
        Create a Razorpay order for payment.
        
        Args:
            amount_inr: Amount in Indian Rupees (e.g., 999.00 for ₹999)
            receipt: Unique receipt ID for your records
            notes: Optional metadata (e.g., user_id, plan_name)
            currency: Currency code (default: INR)
        
        Returns:
            RazorpayOrderDetails with order_id, amount, currency, key
        
        Example:
            order = razorpay.create_order(
                amount_inr=999.00,
                receipt='plan_professional_user123',
                notes={'user_id': 'user123', 'plan': 'professional'}
            )
        """
        if not self.enabled:
            raise RazorpayNotConfigured("Razorpay client not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET")

        # Convert INR to paise (Razorpay uses smallest currency unit)
        amount_paise = int(round(amount_inr * 100))
        
        payload = {
            'amount': amount_paise,
            'currency': currency,
            'receipt': receipt,
            'payment_capture': 1,  # Auto-capture payment
            'notes': notes or {}
        }
        
        logger.info(f"Creating Razorpay order: ₹{amount_inr} ({amount_paise} paise)")
        
        try:
            order = self._client.order.create(payload)
            logger.info(f"✓ Razorpay order created: {order.get('id')}")
            
            return RazorpayOrderDetails(
                order_id=order['id'],
                amount=order['amount'],
                currency=order['currency'],
                key=self.key_id,
                notes=order.get('notes', {})
            )
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {e}", exc_info=True)
            raise

    def verify_payment_signature(
        self, 
        razorpay_order_id: str, 
        razorpay_payment_id: str, 
        razorpay_signature: str
    ) -> bool:
        """
        Verify payment signature after successful payment.
        
        This method validates that the payment callback is genuine and not tampered.
        Call this immediately after receiving payment confirmation from frontend.
        
        Args:
            razorpay_order_id: Order ID from create_order()
            razorpay_payment_id: Payment ID from Razorpay callback
            razorpay_signature: Signature from Razorpay callback
        
        Returns:
            True if signature is valid, False otherwise
        
        Example:
            is_valid = razorpay.verify_payment_signature(
                razorpay_order_id='order_xxxxx',
                razorpay_payment_id='pay_xxxxx',
                razorpay_signature='signature_xxxxx'
            )
            if is_valid:
                # Payment verified - Update user's plan
                mongo_client.update_user_plan(user_id, 'professional')
        """
        if not self.enabled:
            raise RazorpayNotConfigured("Razorpay client not configured")

        try:
            # Razorpay utility function to verify signature
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            
            self._client.utility.verify_payment_signature(params_dict)
            logger.info(f"✓ Payment signature verified: {razorpay_payment_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Payment signature verification failed: {e}", exc_info=True)
            return False

    def fetch_payment(self, payment_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch payment details from Razorpay (optional, for reconciliation).
        
        Args:
            payment_id: Razorpay payment ID
        
        Returns:
            Payment details dict or None if not found
        """
        if not self.enabled:
            raise RazorpayNotConfigured("Razorpay client not configured")

        try:
            payment = self._client.payment.fetch(payment_id)
            return payment
        except Exception as e:
            logger.error(f"Failed to fetch payment {payment_id}: {e}", exc_info=True)
            return None

