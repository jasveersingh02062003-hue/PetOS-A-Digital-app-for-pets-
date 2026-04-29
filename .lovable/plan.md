# Petos — Final Implementation Plan

Covers every remaining gap, grouped into 6 shippable phases. Each phase ends with a working user journey.

---

## Phase P0 — Money Flows Correctly (Week 1)

**Goal:** Every rupee in/out is receipted, refundable, and reconciled.

### P0.1 Email + PDF Receipts (Batch C)
- Set up Lovable Emails infra (`setup_email_infra` + `scaffold_transactional_email`).
- Create React Email template: `payment-receipt.tsx` (branded, line items, GST line, receipt #).
- New edge function `send-receipt-email`: pulls `payment_intents` row, renders PDF via `health-export-pdf` style (reportlab/pdf-lib), attaches download link (Supabase Storage signed URL), invokes `send-transactional-email`.
- Trigger: call from `payments-mark-paid` after status flips `paid`. Idempotency key = `receipt-{intent_id}`.
- "Resend receipt" button on `Receipt.tsx`.

### P0.2 Subscription Webhook (Batch D)
- New edge function `payments-webhook` (sandbox + live, `?env=` param) per stripe-webhooks knowledge.
- Handle `customer.subscription.{created,updated,deleted}` + `checkout.session.completed`.
- Add `environment` column to `subscriptions`; SQL function `has_active_subscription(uid, env)`.
- Replace client-side Plus checks in `useTier.tsx` with server function via RPC.
- Decommission legacy `stripe-webhook`, `create-checkout`, `create-one-time-checkout`, `create-donation-checkout` (leave as 410 shims).

### P0.3 Mating Fee Enforcement
- Migration: add `payment_intent_id` + `paid_until` to `mating_listings` (already exists per plan.md — verify).
- Block `MatesNew` submit → redirect to `/checkout/dynamic?kind=mating_listing&refId=...&amountInr=499`.
- `payments-mark-paid` activates listing for 30 days.
- Hide unpaid listings from `Mates.tsx` query (`active=true AND paid_until > now()`).

### P0.4 Provider Payout Ledger (schema only, P0)
- New table `provider_payouts` (id, provider_user_id, payment_intent_id, gross_inr, commission_inr, net_inr, status, paid_at).
- Trigger on `payment_intents` status=`paid` AND `kind in (service_booking, transport_booking, vet_consult, mating_listing, shop_order)` → insert ledger row with default 15% commission.
- Read-only `Earnings` tab in `vet/Dashboard.tsx` and `ServicesManage.tsx`.

**User journey (P0):**
1. User books taxi ₹250 → Stripe checkout → pays → returns to TaxiDetail showing "Paid · #PETOS-2026-000123".
2. Branded email + PDF receipt arrives within 30s.
3. Driver/provider sees ₹212.50 net entry in their Earnings tab.
4. User upgrades to Plus → webhook syncs → `has_active_subscription` returns true server-side → all gated features unlock instantly.

---

## Phase P1 — Close the AI → Vet → Pharmacy Loop (Week 2)

### P1.1 AI Triage Summary Auto-Handoff
- On "Escalate to live vet" in `VetTriage.tsx`, persist triage transcript + AI summary into new column `vet_consults.triage_summary jsonb`.
- `AppointmentRoom.tsx` shows collapsible "AI pre-triage" panel (symptoms, severity, suggested questions).

### P1.2 Pharmacy Order Flow
- New table `pharmacy_orders` (prescription_id, pet_id, items jsonb, status, shipping_address, payment_intent_id).
- `PrescriptionBuilder.tsx` → "Send to pharmacy" CTA → creates order → dynamic checkout → on paid, status=`processing`.
- Provider-side `pages/pharmacy/Orders.tsx` (gated by `pharmacy_partner` role) to mark `shipped`/`delivered`.

### P1.3 Puppy Sale Marketplace Checkout
- Add `litter_listings` table (litter_id, puppy_index, price_inr, reserved_by, sold_at, payment_intent_id).
- `LittersList.tsx` → "Reserve puppy" → dynamic checkout (₹X) → escrow status `reserved`.
- Breeder confirms handover → status `sold` → triggers payout ledger row + 8% Petos commission.

### P1.4 Commission Splits
- Extend `provider_payouts` trigger with per-kind commission table `commission_rates(kind, rate_pct)`. Seed: taxi 15%, service 12%, vet 10%, mating 100% (flat fee), puppy 8%, shop 5%.

**User journey (P1):**
1. Owner uses AI Vet → severity high → taps "Talk to vet now".
2. Books vet consult, pays ₹99, AI summary auto-attached.
3. Vet writes prescription → owner taps "Order from pharmacy" → pays → pharmacy ships.
4. Separately, breeder lists 6 pups; buyer reserves Pup #3 for ₹25,000; breeder gets ₹23,000 in ledger after handover.

---

## Phase P2 — Trust & Agreements (Week 3)

### P2.1 Digital Mating Agreement
- New table `mating_agreements` (listing_id, owner_id, requester_id, terms jsonb, owner_signed_at, requester_signed_at, pdf_url, status).
- `MatingRequestSheet.tsx` adds "Review & sign agreement" step (canvas signature).
- Edge function `generate-mating-agreement-pdf` (reportlab) → uploads to Storage → signed URL emailed to both parties.
- Block confirmation until both signatures present.

### P2.2 GST on Invoices
- Add `gstin`, `business_name` to `profiles` (provider-side).
- `Receipt.tsx` + PDF template render GST split: subtotal, CGST 9%, SGST 9% (or IGST 18%) + GSTIN line.
- Settings → Billing → "Add GSTIN" form.

### P2.3 Boarding Vaccination Gate
- In `BookAppointment.tsx` for `category=boarding`, call `check_pet_eligible_for_mating`-style RPC `check_pet_boarding_eligible(pet_id)` validating rabies + DHPP < 1yr.
- Block submit with clear remediation ("Upload vaccination record").

**User journey (P2):**
1. Mating: requester pays ₹499 → both parties co-sign on-screen → signed PDF emailed → status `agreed`.
2. Provider with GSTIN sees tax-compliant invoice on every paid order.
3. Boarding booking blocked until pet's rabies cert is in vault.

---

## Phase P3 — Community Safety Net (Weeks 4–5)

### P3.1 Missing-Pet Radius Push
- `MissingNew.tsx` on submit → edge function `missing-pet-broadcast` → queries `profiles` within 5km (PostGIS `ST_DWithin`) → enqueues push via existing `send-push`.
- Throttle: max 1 broadcast per pet per 24h.

### P3.2 Missing-Pet Reward Escrow
- New table `missing_rewards` (missing_pet_id, amount_inr, payment_intent_id, claimed_by, released_at, status).
- "Add reward" button on `MissingDetail.tsx` → dynamic checkout (held in `pending_release`).
- Owner marks "Found by @user" → admin reviews → releases funds to claimant via Stripe Connect transfer (or manual payout v1).

### P3.3 Driver-Side Pet Taxi Tracking
- New role `driver`; `pages/driver/Dashboard.tsx` listing assigned `transport_bookings`.
- Driver app uses `navigator.geolocation.watchPosition` → upserts into `transport_locations(booking_id, lat, lng, updated_at)`.
- Owner's `TaxiDetail.tsx` subscribes via Supabase realtime, shows live marker on `LeafletMap`.

**User journey (P3):**
1. Owner reports missing pet + adds ₹2,000 reward → 47 nearby users get push within 60s.
2. Finder spots pet, owner confirms → admin releases ₹2,000 to finder's account.
3. Separately, taxi rider watches driver's live marker move on map until arrival.

---

## Phase P4 — Hardware Track (Parallel, Weeks 6+)

### P4.1 GPS Tracker
- New table `gps_devices` (pet_id, device_id, sim_iccid, last_seen, battery_pct, paired_at).
- New table `gps_pings` (device_id, lat, lng, ts) with retention policy (30d).
- Tracker firmware POSTs to edge function `gps-ingest` (HMAC-signed device key).
- New page `pages/Tracker.tsx`: live map, geofence (PostGIS polygon in `geofences` table), history playback.
- Subscription product `tracker_monthly` (₹299/mo) — gated via `has_active_subscription(uid, 'tracker')`.

**User journey (P4):**
1. Owner buys tracker → pairs via QR scan → sets home geofence.
2. Pet leaves geofence → push alert "Bruno left home zone".
3. Owner opens live map, sees current location + last 24h trail.

---

## Phase P5 — Polish & Operations

### P5.1 Seed Data Script
- `scripts/seed.ts` (Bun) using service role: creates 1 admin, 1 vet, 1 driver, 1 breeder, 5 owners, 12 pets, 8 services, 4 missing pets, 6 mating listings, 10 health records, 5 paid bookings.
- Idempotent (`upsert` by deterministic UUIDs). Wired to `package.json`: `bun run seed`.

### P5.2 Shop Fulfillment
- Integrate Shiprocket (or manual): on `shop_orders.status=paid`, call edge function `shiprocket-create-shipment` → store `awb_number`, `tracking_url`.
- `Orders.tsx` shows tracking link.

### P5.3 Insurance Commission Tracking
- Add `insurance_referrals` table (user_id, partner, policy_id, premium_inr, commission_inr, status).
- `insurance-webhook` already exists — extend to write commission rows for the ledger.

**User journey (P5):**
1. New developer runs `bun install && bun run seed && bun run dev` → fully populated app in 30s.
2. Shop order → Shiprocket label auto-generated → owner tracks parcel.
3. Insurance signup via partner → commission auto-logged in admin dashboard.

---

## Cross-Cutting Tasks (do alongside each phase)

- **RLS audit** after every new table — owner-select, service-role-write only for money tables.
- **Admin dashboard** extensions per phase: payouts tab (P0), pharmacy queue (P1), agreements review (P2), reward releases (P3), tracker fleet (P4).
- **Notifications**: extend `process-notification-jobs` for: receipt sent, payout settled, agreement signed, reward released, pet left geofence.
- **Tests**: vitest spec per edge function happy path; Stripe sandbox card `4242 4242 4242 4242` for every payment flow.

---

## Suggested Sequencing

```
Week 1: P0 (money correctness)         ← start here
Week 2: P1 (clinical + commerce loop)
Week 3: P2 (legal/trust)
Week 4-5: P3 (safety net)
Week 6+: P4 hardware (parallel track, separate dev)
Ongoing: P5 polish + seed
```

Reply **`go P0`** to begin Phase 0, or name a different phase to start with.