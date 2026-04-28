# Phases 16–37 — Real Status & Remaining Gaps

Verified against the live database, edge functions list, and codebase. Nothing on this page is a guess.

---

## ✅ Fully shipped (no further work)

| Phase | What's live |
|---|---|
| **16 Proactive AI alerts** | `proactive_alerts` table, `ai-proactive-scan` edge function, cron `ai-proactive-scan-6h`, ProactiveAlertsCard wired on Home |
| **17 Symptom diary v2** | `symptom_logs.severity / ai_flag / ai_reason`, `ai-symptom-classify` function, SymptomNew page + flag chips |
| **18 Walker trust** | `service_providers.trust_status / id_proof_path / address_proof_path / quiz_passed_at / years_experience`, `provider_quiz_attempts`, private `trust-docs` bucket, `set_provider_trust_status` admin RPC, `/services/trust/:id` provider UI, Admin → Trust queue, TrustBadge on listings |
| **19 Recurring bookings** | `recurring_bookings` table, `parent_recurring_id` on `service_bookings`, `recurring-booking-spawn` edge function, hourly cron, `/bookings/recurring` management page, BookingSheet "Repeat" toggle |
| **20 Mating listing fee** | `mating_listings.paid_until`, `create-one-time-checkout`, stripe-webhook flips paid_until, `expire_paid_mating_listings()` + daily cron, MatesNew paid-publish flow, MatesGrid filters paid_until |
| **22 Health AI insights** | `health_insights` table, `ai-health-insights` function, HealthInsightsCard on Health page, Plus-tier gating |
| **27 Post-consult Rx → Shop** | `pharmacy_suggestions` + `medication_logs`, vet PrescriptionBuilder, owner PharmacySuggestionsCard on Health → Meds tab, deep-link `/shop?cat=health&q=<med>` |

---

## 🟡 Partial (small finish needed)

None right now. Every "partial" from the previous audit has been closed.

---

## 🔴 Not started — pre-Connect (cheap, no Stripe Connect needed)

These are the **next low-risk shippable phases**.

### Phase 21 — Missing-pet premium boost (₹499)
- DB: add `boosted_until` to `missing_pets`
- Reuse `create-one-time-checkout`; webhook sets `boosted_until = now()+7d`
- Widen `notify_missing_pet_alerts` fan-out radius from 5 km → 15 km when boosted
- MissingFeed: pin boosted to top
- Daily cron to clear expired
- UI: "Boost reach (₹499)" button on MissingDetail

### Phase 23 — NGO donations + featured adoption
- DB: add `accepts_donations`, `donation_url`, `featured_until` to `profiles`; new `donations` table
- Reuse one-time checkout; webhook inserts donation row
- UI: Donate button on shelter profile, Donations tab for org, sort featured first on Adoption feed
- Admin can set `featured_until` from Org Review

### Phase 24 — Shop contextual reminders
- New cron `shop-reorder-scan` daily
- Computes daily portion from `nutrition_logs.brand` × pet weight, projects depletion vs last `shop_orders`
- Writes to existing `proactive_alerts` (5 days before runout)
- Alert deep-links to `/shop?q=<brand>` (already supported)

### Phase 25 — Pregnancy tracker
- DB: `pregnancies` (dam_pet_id, sire_pet_id, mating_request_id, started_on, expected_whelp, status, notes); `pregnancy_milestones` (week, title, ai_tip)
- Trigger on `mating_requests.status='agreed'` auto-creates pregnancy row
- UI: Pregnancy panel on dam profile with 9-week tracker + weekly tips, "Create litter" CTA on whelp

### Phase 26 — Pickup/drop ("pet taxi")
- DB: `transport_legs` (booking_id, kind pickup|drop, address, scheduled_at, status, fare_inr, driver_id, started_at, ended_at)
- Reuse `walk_tracks` for live trace + existing public_share_token
- UI: BookingSheet pickup/drop toggles, provider "Start trip" → WalkLive, owner live map

---

## 🚪 Stripe Connect Gate (Phase 28) — required for 29–34

### Phase 28 — Stripe Connect onboarding
- DB: `stripe_accounts` (user_id, account_id, type, charges_enabled, payouts_enabled, country, status)
- Edge functions: `connect-onboard`, `connect-refresh`, `connect-webhook`
- Payouts page from vet/walker/boarder/breeder/NGO dashboards; status pill gates "accept paid bookings"

### Phase 29 — Marketplace booking payouts
- On `service_bookings.status='completed'` → `payout-booking` does Stripe Transfer minus category fee (vet 20%, walker 15%, boarder 18%, grooming 15%)
- `payouts` table + provider Earnings tab

### Phase 30 — Puppy-sale commission + escrow
- `adoption_listings` table needed (does not exist yet)
- Hold funds until buyer confirms receipt; 90/10 split; admin Disputes panel

### Phase 31 — Missing-pet reward escrow + payout
- `missing_pet_rewards` (missing_pet_id, owner_id, amount_inr, stripe_pi_id, status, finder_id)
- "Pledge reward" + "Mark found, pick finder" → release minus 5%

### Phase 32 — Recurring shop orders (subscriptions)
- Stripe Subscription with shipping interval; `subscription_orders` table
- `subscription-fulfill` cron creates next `shop_orders` per cycle

### Phase 33 — Diet-plan marketplace
- `diet_plans` + `diet_plan_purchases`; vets keep 80%
- Vet authoring page + Health → Diet plans tab

### Phase 34 — GPS tracker subscription billing
- Depends on Phase 35 schema
- Stripe recurring price ₹199/month tied to `gps_devices.subscription_status`

---

## 🛠 Hardware Gate (35–37)

### Phase 35 — GPS device data model + ingestion
- `gps_devices`, `gps_device_pings`; `gps-ingest` HMAC-signed function
- Settings → Devices pair-by-serial + live map

### Phase 36 — Geofence + alerts
- `geofences` table; trigger on ping calculates distance and fires push when outside

### Phase 37 — Hardware SKU in Shop
- `shop_products.kind='gps_device'`; auto-create `gps_devices` row on order completion with admin-assigned serial

---

## Recommended next step

**Phase 25 — Pregnancy tracker.** Single new table family, no payments, no Stripe Connect, fits naturally on existing pet profile, and ties two already-shipped features together (mating requests → litters). Smallest credit batch with clear user value.

Reply with the phase number to ship next; I'll do that one only, fully wired end-to-end.
