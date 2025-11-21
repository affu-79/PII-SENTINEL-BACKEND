"""Utilities to generate invoice PDFs for purchases."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from utils import ensure_dir


class InvoiceService:
    """Builds branded invoice PDFs and returns their storage path."""

    def __init__(self, base_path: str, *, company_name: str = "Anoryx Tech Solutions Pvt Ltd"):
        self.base_path = base_path
        self.company_name = company_name
        ensure_dir(self.base_path)

    def _build_filepath(self, transaction_id: str) -> str:
        safe_id = transaction_id.replace('/', '-').replace(' ', '')
        return os.path.join(self.base_path, f"Invoice-{safe_id}.pdf")

    def generate(self, payload: Dict[str, Any]) -> str:
        transaction_id = payload.get('transaction_id') or datetime.utcnow().strftime('%Y%m%d%H%M%S')
        filepath = self._build_filepath(transaction_id)

        invoice_date = payload.get('timestamp')
        if isinstance(invoice_date, datetime):
            invoice_date = invoice_date.strftime('%Y-%m-%d %H:%M:%S UTC')
        elif not invoice_date:
            invoice_date = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')

        user_info = payload.get('user', {})
        purchase = payload.get('purchase', {})
        notes = payload.get('notes', {})

        c = canvas.Canvas(filepath, pagesize=A4)
        width, height = A4
        margin = 20 * mm
        y = height - margin

        # Header
        c.setFont("Helvetica-Bold", 18)
        c.drawString(margin, y, self.company_name)
        y -= 14

        c.setFont("Helvetica", 10)
        c.drawString(margin, y, "Anoryx Tech Solutions Pvt Ltd")
        y -= 12
        c.drawString(margin, y, "Invoice")
        y -= 20

        # Invoice meta
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, f"Invoice Date: {invoice_date}")
        y -= 12
        c.drawString(margin, y, f"Invoice ID: {payload.get('transaction_id', 'NA')}")
        y -= 12
        c.drawString(margin, y, f"Order ID: {payload.get('order_id', 'NA')}")
        y -= 20

        # Bill to
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, "Billed To:")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, f"Name: {user_info.get('name', user_info.get('email', 'Customer'))}")
        y -= 12
        c.drawString(margin, y, f"Email: {user_info.get('email', 'NA')}")
        y -= 12
        if user_info.get('company'):
            c.drawString(margin, y, f"Company: {user_info.get('company')}")
            y -= 12
        if user_info.get('phone'):
            c.drawString(margin, y, f"Phone: {user_info.get('phone')}")
            y -= 12
        y -= 10

        # Purchase summary
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, "Purchase Summary")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, f"Type: {purchase.get('type', 'Plan')} ")
        y -= 12
        if purchase.get('name'):
            c.drawString(margin, y, f"Name: {purchase.get('name')}")
            y -= 12
        if purchase.get('tokens') is not None:
            c.drawString(margin, y, f"Tokens: {purchase.get('tokens')}")
            y -= 12
        if purchase.get('details'):
            c.drawString(margin, y, f"Details: {purchase.get('details')}")
            y -= 12
        y -= 10

        # Payment details
        amount_inr = payload.get('amount_inr', 0)
        currency = payload.get('currency', 'INR')
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, "Payment Details")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, f"Amount Paid: {amount_inr:.2f} {currency}")
        y -= 12
        c.drawString(margin, y, f"Razorpay Payment ID: {payload.get('razorpay_payment_id', 'NA')}")
        y -= 12
        if payload.get('razorpay_order_id'):
            c.drawString(margin, y, f"Razorpay Order ID: {payload.get('razorpay_order_id')}")
            y -= 12
        if notes:
            c.drawString(margin, y, "Notes:")
            y -= 12
            for key, value in notes.items():
                c.drawString(margin + 12, y, f"{key}: {value}")
                y -= 12

        c.setFont("Helvetica-Oblique", 8)
        footer_text = "Thank you for choosing PII Sentinel for your privacy automation needs."
        c.drawString(margin, margin, footer_text)

        c.showPage()
        c.save()

        return filepath
