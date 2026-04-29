# PetOS — Launch Checklist

Last updated: 2026-04-29

This document captures every flow shipped through P0–P5 and the operational
hand-offs that still need to happen outside the app before public launch.

---

## 1. Feature recap (what's in the app)

| Phase | Capability | Key entry points |
|------|-----------|------------------|
| P0 | Payments, receipts, earnings, refunds, payouts | `/receipt/:id`, provider dashboards (`EarningsCard`) |
| P1 | AI-triage → Vet consult handoff, pharmacy suggestions, puppy reservation deposit | `/book-vet`, `/adopt/:id`, shop search |
| P2 | Digital mating agreement (lock + PDF), GST-compliant invoices, boarding vaccination gate | Agreement detail, `/receipt/:id`, `BookingSheet` |
| P3 | Radius missing-pet alerts, reward escrow (fund → release), driver live tracking | `/missing/:id`, `/taxi/:id` |
| P4 | GPS tracker (devices, pings, geofences, breach alerts) | `/pets/:petId/tracker` |
| P5 | Reward escrow funding loop + demo seed data | `/missing/:id` (owner) |

---

## 2. End-to-end user journeys

### 2.1 New owner onboarding
1. Sign up → email verification → onboarding → add first pet → land on home feed (with seed posts visible).

### 2.2 AI → Vet → Pharmacy
1. Owner opens AI chat → describes symptoms → AI returns triage + pharmacy suggestions.
2. "Book a vet" → `/book-vet` → on confirm, `create_consult_from_appointment` mirrors the AI summary into `vet_consults`.
3. Vet opens consult → reads triage → marks resolved.
4. Pharmacy suggestion → owner taps "Find in shop" → pre-filled search → order.

### 2.3 Boarding with health gate
1. Owner picks a boarding/daycare service → `BookingSheet` calls `check_pet_boarding_eligible`.
2. If vaccinations missing (DHPP/Rabies for dogs, FVRCP/Rabies for cats), the booking is blocked with a "Update vaccinations" link.
3. Otherwise booking proceeds → payment intent → receipt with GST.

### 2.4 Mating agreement
1. Both owners agree on terms → both sign → trigger locks the agreement and stamps `agreement_number` (`PMA-YYYYMMDD-ID`).
2. "Download signed PDF" button calls `mating-agreement-pdf` edge function → returns A4 PDF from the private `agreements` bucket.

### 2.5 Puppy reservation deposit
1. Buyer opens a `breeder_sale` listing → "Reserve with deposit" → checkout (kind = `puppy_sale`).
2. Webhook stamps payment → `tg_create_provider_payout` splits commission (default 8%) → seller receives net.

### 2.6 Missing pet — full reward loop
1. Owner reports missing → trigger enqueues `missing_pet_fanout` job with last-seen lat/lng + 15 km radius.
2. Cron drains queue → `find_users_within_radius_km` finds nearby users → push to each.
3. Owner optionally taps "Fund ₹X reward (escrow)" → checkout (kind = `reward_escrow`) → webhook marks `reward_status='escrowed'`.
4. Bystander reports sighting → owner sees realtime update → taps "Release ₹X reward" on that sighting → `release_reward` RPC creates payout, marks pet resolved, notifies finder.

### 2.7 Pet taxi with live tracking
1. Owner books a pet taxi → driver accepts → status moves through the FLOW chain.
2. Driver's app pings GPS every 30 s via `update_driver_location`.
3. Customer's `TaxiDetail` page shows the live driver pin via realtime + last-update time.

### 2.8 GPS tracker + geofence
1. Owner opens pet profile → "Live GPS tracker" → pair a tracker (collar / airtag / phone / other) → 8-char pairing code generated.
2. "Send phone ping" or hardware pushes via `ingest_gps_ping` → realtime updates the map.
3. Owner adds a safe zone → next ping outside any active fence flags `outside_geofence=true` and pushes "{Pet} left their safe zone".

---

## 3. Operational hand-offs (not buildable in code)

These items must be configured before public launch. Each is independent.

### 3.1 Business email domain (blocks transactional email)
- **What's pending**: Receipt PDF auto-email, mating agreement email delivery, magic-link sender domain.
- **Action**: When a business email domain is ready, add it via Connectors → Email and re-run `email_domain--setup_email_infra`. The receipt and agreement code paths are already in place — they only need the verified domain.

### 3.2 Web Push (VAPID) keys for browser notifications
- **What's pending**: `send-push` edge function currently no-ops in beta when VAPID keys are missing.
- **Action**: Generate a VAPID keypair (`web-push generate-vapid-keys`) and add three secrets to the project:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (e.g. `mailto:hello@yourdomain.com`)
- The push-subscription flow on the client and the `send-push` function already work — they just need the keys.

### 3.3 Payments
- Lovable's built-in Stripe payments handle the entire commerce loop (consults, bookings, reservations, reward escrow, mating, boost reach). No external account or API key needed — go-live is a settings toggle.
- After enabling, run a small live transaction in each `payment_kind` to confirm webhooks land and payouts are queued.

### 3.4 GPS hardware (optional)
- Software is fully ready: any device firmware can `POST` to `/rest/v1/rpc/ingest_gps_ping` with a pairing code.
- For phone-as-tracker, no hardware is needed — the in-app "Send phone ping" button already works.
- For collars/AirTag-style devices, pick a vendor that exposes either an HTTP webhook or a relay we can configure.

### 3.5 Insurance & shop fulfilment partners
- `insurance-webhook` edge function is wired; partner integration only needs the webhook URL + a shared secret.
- Shop orders currently route to in-house fulfilment; for drop-ship/3PL, point the `pharmacy_orders` status writer at the partner's webhook.

### 3.6 Payout reconciliation
- `provider_payouts` rows are created on every paid intent that has a recipient.
- Before live launch: pick a payout cadence (weekly / on-demand) and add a finance dashboard view (one query off `provider_payouts` grouped by recipient + status).

---

## 4. Pre-flight QA list

- [ ] Smoke-test each `payment_kind`: `vet_consult`, `appointment`, `service`, `transport`, `mating`, `puppy_sale`, `reward_escrow`, `agreement`, `missing_listing`.
- [ ] Confirm receipt page renders correct GST split (intra vs inter-state) for at least one transaction.
- [ ] Trigger a missing-pet from a profile with `lat/lng` set and verify a second test profile within 15 km receives the push.
- [ ] Pair a phone tracker, add a safe zone, walk outside the radius, confirm the breach push.
- [ ] Run a mating agreement to fully-signed and download the PDF.
- [ ] Verify boarding bookings block when vaccinations are missing.
- [ ] Send a test taxi trip and confirm the customer sees the driver pin update live.

---

## 5. What's intentionally NOT in scope

- Native mobile app (the project is a PWA; install prompt is at `/install`).
- Physical GPS hardware production.
- Manual moderation queue UI for missing-pet and listing reports (auto-moderation via `moderate-content` is live).
- Multi-currency — INR only at launch.
