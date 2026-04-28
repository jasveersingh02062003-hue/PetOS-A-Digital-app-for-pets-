
# Gap audit: what's done, partial, and missing across Phases 16–37

I scanned every table, edge function, page, and component referenced in your rollout plan. Here's the honest status of each phase, then a recommended next-step order.

---

## Status legend

- DONE — DB + edge function + UI all wired
- PARTIAL — some pieces exist but the loop isn't closed end-to-end
- MISSING — nothing in the codebase yet

---

## Pre-Connect block (Phases 16–27)

### Phase 16 — AI proactive alerts (cron) — DONE
Found: `proactive_alerts` table (with `severity`, `dedupe_key`, `dismissed_at`), `ai-proactive-scan` edge function, `src/components/home/ProactiveAlertsCard.tsx` mounted on Home.
Open question to confirm: is the pg_cron job actually scheduled (every 6h)? The function exists; the schedule registration may not be.

### Phase 17 — Symptom diary v2 + AI severity flag — DONE
Found: `symptom_logs.severity / ai_flag / ai_reason / photo_url`, edge function `ai-symptom-classify`, symptom UI in `Health.tsx` and `health/Timeline.tsx`.

### Phase 18 — Walker trust gate — PARTIAL
Found: `service_providers.trust_status / id_proof_path / address_proof_path / quiz_passed_at / quiz_score`, plus `provider_quiz_attempts` table.
Missing: the dedicated `walker_profiles` model, the walker onboarding page, and the trigger that blocks `category='dog_walker'` activation until approved. Right now the trust columns exist but nothing enforces "can't go live until passed".

### Phase 19 — Recurring bookings — PARTIAL
Found: `recurring_bookings` table and a "Repeat" toggle in `BookingSheet.tsx`.
Missing: the daily `recurring-booking-spawn` edge function + cron that materializes the next concrete `service_bookings` row, and the owner/provider "Recurring" management section with pause/cancel.

### Phase 20 — Mating listing fee — PARTIAL
Found: `mating_listings.paid_until / boosted_until / featured`, plus a `mating_payments` table.
Missing: the publish-flow that pushes the user through `create-one-time-checkout`, the webhook hook that flips `paid_until = now()+30d`, the `draft → active` state machine on listings, and the cron that expires them. The schema is staged, the UX is not.

### Phase 21 — Missing-pet premium boost — MISSING
The `missing_pets` table has no `boosted_until` column, no boost button in UI, no fan-out radius switch, no expiry cron.

### Phase 22 — Health AI insights surface — DONE
Found: `health_insights` table, `ai-health-insights` edge function, `HealthInsightsCard` mounted in `Health.tsx`.
Confirm: weekly refresh cron and Plus-tier gating on extra cards.

### Phase 23 — NGO donations + featured adoption — MISSING
`profiles` has only `breeder_verified`. No `accepts_donations`, `donation_url`, `featured_until`, no `donations` table, no donate button on `OrgProfile.tsx`, no admin "feature org" action.

### Phase 24 — Shop contextual reorder reminders — MISSING
No `shop-reorder-scan` edge function. The `proactive_alerts` infra (from Phase 16) is ready to receive these alerts, but the scanner that compares `nutrition_logs.brand` × `shop_orders` × portion math doesn't exist.

### Phase 25 — Pregnancy tracker — MISSING
No `pregnancies`, no `pregnancy_milestones`, no trigger on `mating_requests.status='agreed'`, no UI panel on dam profile.

### Phase 26 — Pickup/drop ("pet taxi") — MISSING
No `transport_legs` table. The Discover tile and a `ServiceNew` mention exist as marketing surfaces only.

### Phase 27 — Post-consult Rx → Shop — PARTIAL
Found: `src/components/vet/PrescriptionBuilder.tsx`, `appointments.prescription` column, `pharmacy_suggestions` table, references in `VetConsult.tsx` and `MedicationsTab`.
Missing: the dedicated `consult_prescriptions` table with structured `items jsonb`, and the owner-side "Buy meds" CTA that prefills the Shop cart by SKU. Right now Rx is captured loosely on the appointment but doesn't push the buyer into checkout.

---

## Stripe Connect block (Phases 28–34) — ALL MISSING

No `stripe_accounts`, `payouts`, `missing_pet_rewards`, `subscription_orders`, `diet_plans`, `diet_plan_purchases` tables. No `connect-onboard / connect-refresh / connect-webhook / payout-booking / subscription-fulfill` edge functions. The existing `stripe-webhook` handles `subscriptions` (Plus tier) only; it does not handle Connect transfers, escrow, or marketplace splits.

- Phase 28 Connect onboarding — MISSING
- Phase 29 Marketplace payouts on bookings — MISSING
- Phase 30 Puppy-sale commission + escrow — MISSING
- Phase 31 Missing-pet reward escrow + payout — MISSING
- Phase 32 Recurring shop orders (Stripe Subscriptions) — MISSING
- Phase 33 Diet-plan marketplace — MISSING
- Phase 34 GPS tracker subscription billing — MISSING (depends on 35 too)

---

## Hardware block (Phases 35–37) — ALL MISSING

No `gps_devices`, `gps_device_pings`, `geofences`. No `gps-ingest` function. No "Devices" tab in Settings. No `shop_products.kind='gps_device'` flag.

- Phase 35 GPS device data + ingestion — MISSING
- Phase 36 Geofence + alerts — MISSING
- Phase 37 Hardware SKU in Shop — MISSING

---

## Summary scoreboard

```text
DONE       (3): 16, 17, 22
PARTIAL    (4): 18, 19, 20, 27
MISSING   (15): 21, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37
```

Total in your roadmap: 22 phases. Roughly **14% fully shipped, 18% half-shipped, 68% untouched.**

---

## Recommended next-phase order (revenue + UX first, hardware last)

The cheapest, highest-value moves are to **finish what's already half-built** before opening any new fronts. That converts staged schema into actual user value with minimal new surface area.

### Tier 1 — close the partials (small credit batches each)

1. **Phase 20 finish** — wire `mating_listings` publish → `create-one-time-checkout` → webhook flips `paid_until`, plus the expiry cron. Schema is ready; this is the smallest path to first paid feature.
2. **Phase 19 finish** — ship `recurring-booking-spawn` daily edge function + cron + management UI. Table already exists.
3. **Phase 27 finish** — add `consult_prescriptions` (structured items), owner "Buy meds" deep-link into Shop cart.
4. **Phase 18 finish** — add the trigger that blocks walker activation until approved, plus the walker onboarding flow that uses the existing trust columns.

### Tier 2 — quick standalone wins

5. **Phase 21** — missing-pet boost. Reuses one-time checkout, single new column + cron.
6. **Phase 24** — shop reorder reminders. Reuses `proactive_alerts` infra; pure cron + math.
7. **Phase 23** — NGO donations + featured adoption. Reuses one-time checkout.
8. **Phase 25** — pregnancy tracker. Self-contained; rides on `mating_requests` trigger.
9. **Phase 26** — pet-taxi transport legs. Reuses `walk_tracks` for live trace.

### Tier 3 — Stripe Connect gate (one big credit batch, then unlocks 6 phases)

10. **Phase 28** Connect onboarding — required before 29–34. Plan this as its own larger phase.
11. Then 29 → 32 → 31 → 30 → 33 → 34 in roughly that order (29 is the most reused infrastructure; 30 has the most legal complexity around escrow/disputes; 34 needs Phase 35 in place).

### Tier 4 — hardware gate (only when device partner is real)

12. Phase 35 → 36 → 37, in order. Don't start until you actually have a device.

---

## Gotchas worth flagging now

- **Phase 16 cron**: the `ai-proactive-scan` function exists but I cannot tell from a code read whether `cron.schedule` was actually inserted. If alerts aren't appearing on a schedule, that's the cause. Worth verifying before declaring 16 fully done.
- **Phase 22 weekly refresh**: same risk — the function and table exist, but the weekly cron may not be registered.
- **Phase 27 model collision**: when we add `consult_prescriptions`, decide whether to keep `appointments.prescription` (free text) or migrate to the structured table only. Two sources of truth will hurt later.
- **Plus-tier gating** is wired (`current_tier()` exists) — every revenue phase should reuse it for upsell paths, not invent its own.

---

## What I need from you to proceed

Tell me which phase to ship next. My pick is **Phase 20 finish** (mating listing fee) — schema is staged, the checkout function already exists, and it turns on revenue with the smallest credit spend. After that, Phase 19 finish, then Phase 27 finish, then Phase 21.

If you want, I can also (cheaply, in plan-only mode) verify whether the Phase 16 and Phase 22 crons are actually registered before you spend credits assuming they are.
