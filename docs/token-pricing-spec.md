# Token-Based Pricing & Billing Specification

## Overview
PII Sentinel is migrating from feature-based plans to a token-based billing system. Tokens represent consumable credits for running privacy actions (uploads, locking JSON, unlocking JSON, analysis boards). Pricing, UI, backend, and Razorpay integration must be updated holistically.

## Plans & Allowances
| Plan | Price | Tokens | Notes | Feature Flags |
| --- | --- | --- | --- | --- |
| Starter | Free | 5 tokens / day (bucketed to 150 tokens per month to simplify accounting) | Uploads consume 1 token; Lock/Unlock unavailable; Analysis board disabled | lock_json: false, unlock_json: false, advanced_analysis: false |
| Professional | ₹999 / month | 500 tokens per month | Lock JSON = 5 tokens; Unlock JSON = 5 tokens; Upload = 1 token | lock_json: true, unlock_json: true, advanced_analysis: true |
| Enterprise | ₹4999 / month | Unlimited tokens (no deductions) | Includes log records, all features | lock_json: true, unlock_json: true, advanced_analysis: true |

### Add-On Tokens
* Purchasable in custom quantities at ₹20/token.
* Razorpay checkout calculates total = tokens × ₹20.
* Add-on tokens credited immediately after payment confirmation.
* Invoice generated and stored.

## Token Consumption Rules
| Action | Token Cost | Notes |
| --- | --- | --- |
| Upload document/image | 1 token | Deduct for Starter/Professional only |
| Lock JSON | 5 tokens | Enterprise exempt |
| Unlock/Verify JSON | 5 tokens | Enterprise exempt |
| Advanced Analysis Board | 0 tokens (availability gated) |

Token deductions must be atomic: multiple simultaneous requests should not create negative balances or double deductions.

## Data Model Changes (Users Collection/Table)
```
plan_id: string (starter, professional, enterprise)
subscription: {
  status: 'trial' | 'active' | 'expired' | 'cancelled',
  razorpay_subscription_id?: string,
  current_period_start?: Date,
  current_period_end?: Date
}
tokens_total: number (lifetime tokens allocated)
tokens_used: number (lifetime tokens consumed)
tokens_balance: number (current available tokens)
features_enabled: {
  lock_json: boolean,
  unlock_json: boolean,
  advanced_analysis: boolean
}
last_token_reset?: Date
```

### Token Ledger
Introduce a `token_transactions` collection/table to maintain audit history.
```
{
  _id,
  user_id,
  type: 'credit' | 'debit',
  amount: number,
  reason: 'plan_allocation' | 'addon_purchase' | 'upload' | 'lock_json' | 'unlock_json',
  metadata: { plan_id?, tokens?, file_id?, invoice_id?, razorpay_payment_id? },
  balance_after: number,
  created_at: Date
}
```

## Backend Endpoints
1. `POST /api/purchase/plan`
   * Input: plan_id, billing_period (monthly)
   * Flow: create Razorpay order/subscription, return checkout info
2. `POST /api/purchase/addons`
   * Input: tokens_requested
   * Flow: create Razorpay order for add-on tokens
3. `POST /api/razorpay/webhook`
   * Validates signature
   * Handles events: `payment.captured`, `subscription.charged`
   * Updates plan, credits tokens, records ledger, generates invoice PDF
4. `POST /api/action/consume-token`
   * Input: action_type ('upload'|'lock_json'|'unlock_json'), metadata
   * Deduct tokens atomically (skip for enterprise)
5. `GET /api/user/tokens`
   * Returns balance, used, total, plan info, feature flags
6. `POST /api/invoice/:txId`
   * Returns signed URL or PDF stream for invoice download

### Helper APIs
* `POST /api/admin/allocate-tokens` (optional) – manual adjustments.

## Razorpay Integration
* Plans & add-ons use Razorpay Orders.
* Maintain Razorpay keys in env.
* Checkout flows: plan selection (starter upgrade → no payment), professional, enterprise, add-ons.
* Webhook verifying `X-Razorpay-Signature`.
* On success:
  * Update `plan_id`, `subscription.status`, `features_enabled`.
  * Credit tokens (`tokens_total`, `tokens_balance`), ledger entry.
  * Generate invoice PDF (with user/plan/token info, Razorpay IDs) and store metadata.

## Invoice Generation
* PDF template with company header (Anoryx Tech Solutions Pvt Ltd), user billing details, purchase summary.
* Stored in `invoices` table/collection with Razorpay payment/order IDs and URL/path.
* Download endpoint (`POST /api/invoice/:txId`) returns PDF.

## Frontend/UX Requirements
1. **Pricing Page**
   * Three plan cards + Add-on card using premium styling.
   * Animated billing toggle (monthly vs yearly placeholder for now).
   * Feature lists use bullet icons.
   * Add-on card allows token input, calculates price (tokens × ₹20), triggers Razorpay checkout.
   * After payment, show success modal with invoice download link.

2. **Profile Page Plan Section**
   * Display current plan, tokens total, used, balance.
   * Include “Top up tokens” button → Razorpay add-on flow.
   * Show premium badges for enabled features.
   * Auto-refresh data after purchase (poll `/api/user/tokens` or use websocket/event).

3. **Feature Gating**
   * Upload, lock JSON, unlock JSON, advanced analysis components check `features_enabled` and token balance.
   * If insufficient tokens or feature disabled → show upgrade modal linking to pricing page.

4. **Contact Sales CTA**
   * Any “Contact Sales” action routes to `/about#contact`.

5. **Responsiveness & Animations**
   * Pricing cards stack on mobile.
   * Toggle becomes single-row on mobile.
   * Use subtle transitions for modals, button hovers, card highlights.

## Token Reset Logic
* Starter plan – convert 5 tokens/day to 150 tokens/month to simplify accounting. Reset balance monthly (cron job) to min(current balance, 150?) or top-up by difference.
* Professional plan – monthly allocation of 500 tokens at subscription renewal.
* Enterprise plan – set a high sentinel value or flag to skip deduction.

## Migration Plan
1. Deploy schema migration for new fields & tables.
2. Backfill existing users (`plan_id` default to 'starter', `tokens_balance` = 150, etc.).
3. Disable previous plan purchase flows.
4. Roll out frontend changes after backend ready.

## Testing Checklist
* Unit tests for token deduction (including race conditions).
* Webhook signature validation tests.
* Integration tests for purchase flows (mock Razorpay).
* UI tests for pricing page, profile tokens section, gating modals.
* Invoice PDF generation snapshot tests.

---
This specification will guide the implementation phases listed in the todo list. Ensure all teams sign off before coding.
