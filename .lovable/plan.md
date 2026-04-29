# Phase 29 Status & Completion Plan

## What's already done

### Database (live)
- `payment_intents` table — full schema with `receipt_number`, `refunded_amount_inr`, `refund_reason`, `metadata`, `provider_payment_intent_id`, `price_id`, `currency`. Trigger auto-assigns `PETOS-YYYY-NNNNNN` receipt numbers.
- Status enum: `beta_free | pending | paid | failed | refunded`.
- `subscriptions`, `service_bookings`, `transport_bookings`, `shop_orders`, `mating_payments`, `donations` tables exist.
- Stripe products created in sandbox: Petos Plus (₹199/mo, ₹1,999/yr), AI Vet Consult (₹99), Missing Pet Boost (₹149), Mating Listing (₹499), NGO Donation.

### Edge functions
- `payments-create-checkout` — embedded Stripe session, recurring + one-time, sandbox/live aware ✅
- `payments-mark-paid` — verifies session, writes `payment_intents` row ✅
- `payments-refund` — server-side refund w/ role check ✅
- `create-one-time-checkout`, `create-donation-checkout`, `create-checkout`, `stripe-webhook` — older checkout/webhook functions still present (legacy)

### Frontend
- `/checkout/:priceId` (branded) + `/checkout/return` (animated success + receipt #)
- `StripeEmbeddedCheckout` component with `PaymentTestModeBanner`
- `RefundButton` component (built, not placed anywhere yet)
- `Receipt.tsx` page (printable)
- **Wired to checkout:** `Plus.tsx`, `MissingDetail.tsx` (boost), `DonateDialog.tsx`, `PaywallSheet.tsx`

## What's missing / not wired

| Area | Gap |
|---|---|
| Mating listings | No payment gate; `mating_payments` table exists but unused |
| Service bookings | `service_bookings` has no `payment_intent_id`; no checkout flow |
| Transport / Pet taxi | `transport_bookings` has no `payment_intent_id`; `RefundButton` not on `TaxiDetail` |
| Shop orders | `shop_orders` has no Stripe checkout; `Cart` → "place order" but no payment |
| AI Vet Consult | Price exists, no entry point in `AskVet`/`VetConsult` |
| Receipts | `payment_intents` row created, but no link from any booking detail page to `/receipt/:id` |
| Email receipts | Not sent (no transactional email function) |
| PDF invoice | Not generated (Receipt page is browser-print only) |
| Webhook | `payments-webhook` per knowledge file not yet created (only legacy `stripe-webhook`); subscription lifecycle not synced into `subscriptions` table from new flow |
| Refund button | Built but not mounted anywhere |
| Admin view | No admin page to see all payments / issue refunds |

## Implementation Plan (4 batches, each shippable)

### Batch A — Wire all paid flows to checkout (DB + UI)
1. Migration: add `payment_intent_id uuid references payment_intents(id)` to `service_bookings`, `transport_bookings`, `shop_orders`, `mating_listings`. Add `paid_at timestamptz`.
2. Update `payments-mark-paid` to accept `kind` + `ref_id` and stamp the parent row's `payment_intent_id` + `paid_at` after success.
3. Add "Pay & confirm" button →`/checkout/:priceId?ref=<bookingId>&kind=<kind>` on:
   - `TaxiNew` / `TaxiDetail` (transport)
   - `BookAppointment` / `ServiceDetail` (service)
   - `MatesNew` / `MateListing` (mating ₹499)
   - `Cart` (shop — dynamic price via `create-one-time-checkout` price_data)
   - `AskVetNew` / `VetConsult` (AI vet ₹99)
4. `Checkout.tsx` reads `?ref=&kind=` and passes through metadata so webhook/`mark-paid` updates the right row.

### Batch B — Refunds, receipts visible everywhere
1. Mount `RefundButton` on: `TaxiDetail`, `MyAppointments` row, `Orders` row, `MateListing` (owner view), `Plus` (cancel sub).
2. Add "View receipt" link on every paid booking → `/receipt/:intentId`.
3. Add `Admin → Payments` page: table of `payment_intents` (filters by status/kind/date) with refund + view receipt actions. Admin gated via `has_role('admin')`.

### Batch C — Email + PDF receipts
1. Set up branded transactional email (resend or Lovable email infra) — domain config.
2. Edge function `send-receipt-email`: takes `intentId`, renders branded HTML + attaches PDF (rendered server-side via `health-export-pdf` style).
3. Trigger from `payments-mark-paid` after status flips to `paid`.
4. Re-send button on `Receipt.tsx`.

### Batch D — Subscription webhook + cleanup
1. Create `payments-webhook` per knowledge spec (sandbox + live), handle `customer.subscription.{created,updated,deleted}` → upsert into `subscriptions`.
2. Add `has_active_subscription(user_id, env)` SQL function; replace any client-side Plus checks.
3. Decommission legacy `create-checkout`, `create-one-time-checkout`, `create-donation-checkout`, `stripe-webhook` once new flow covers them (or leave as thin shims).
4. RLS audit on `payment_intents` (owner-select, service-role-write only).

## Suggested order
Batch A → B → C → D. Each batch is independently testable in sandbox using `4242 4242 4242 4242`.

## Open decisions (will ask before Batch C)
- Email provider (Resend default, or use existing setup)
- Sender domain for receipts (e.g. `receipts@petos.app`)
- GST number on invoice — needed?

Reply **`go A`** (or B/C/D) to start the batch, or tell me to adjust scope.
