
# Remaining-gaps rollout plan

Each phase is **independent** (no overlap), **fully wired** (DB → RLS → trigger → edge function → UI → realtime where needed), and shipped end-to-end before moving on. No mock data, no half-flows. One phase = one approval = one credit batch.

Phases are ordered so each one is deliverable on its own AND the cheap, no-billing-dependency phases ship first to bank value before we touch Stripe Connect (the biggest single piece).

---

## Dependency map (read once, then stop worrying about it)

```text
Phase 16  AI proactive alerts cron        ── independent
Phase 17  Symptom diary v2 + AI flag      ── independent
Phase 18  Walker trust gate (quiz + ID)   ── independent
Phase 19  Recurring bookings              ── builds on 18
Phase 20  Mating listing fee              ── uses existing one-time checkout
Phase 21  Missing-pet premium boost       ── uses existing one-time checkout
Phase 22  Health AI insights surface      ── independent (read-only analytics)
Phase 23  Donate-to-NGO + featured adopt  ── uses existing one-time checkout
Phase 24  Shop contextual reminders       ── independent (cron + push)
Phase 25  Pregnancy tracker               ── independent
Phase 26  Pickup/drop ("pet taxi" leg)    ── independent
Phase 27  Post-consult Rx → Shop deep-link── independent
─────────────  STRIPE CONNECT GATE  ─────────────
Phase 28  Stripe Connect onboarding       ── unlocks 29–34
Phase 29  Marketplace payouts (vets/walkers/boarders)
Phase 30  Puppy-sale commission + escrow
Phase 31  Missing-pet reward escrow + payout
Phase 32  Recurring shop orders (subscriptions)
Phase 33  Diet-plan marketplace (vets sell plans)
Phase 34  GPS tracker subscription billing
─────────────  HARDWARE GATE  ───────────
Phase 35  GPS device data model + ingestion
Phase 36  Geofence + alerts
Phase 37  Hardware SKU in Shop
```

---

## Phase 16 — AI proactive alerts (cron)
**Gap closed:** C. AI proactive push alerts.
**Backend:** new `proactive_alerts` table (user_id, pet_id, kind, body, link, created_at, dismissed_at). Edge function `ai-proactive-scan` runs every 6h via pg_cron; for each pet it inspects last 7 days of `nutrition_logs`, `weights`, `symptom_logs`, `medications` and writes alerts (e.g. "Max ate 2 extra meals yesterday — watch for diarrhea", "Bella's weight up 8% in 30 days"). Reuses `notify_user()` for push.
**Frontend:** new `<ProactiveAlertsCard>` on Home above the feed, dismiss-to-archive, deep-link to relevant Health tab.
**Acceptance:** insert 3 nutrition rows for a test pet → run function manually → an alert row appears, push fires, card shows it, dismiss persists.

## Phase 17 — Symptom diary v2 + AI severity flag
**Gap closed:** B. minimal symptom diary.
**Backend:** add `severity` (1–5), `ai_flag` (`watch | vet_soon | emergency`), `ai_reason` to `symptom_logs`. Trigger calls edge function `ai-symptom-classify` (gpt-5-mini) on insert; if `emergency`, auto-creates a notification + suggests EmergencyButton.
**Frontend:** new `SymptomNew.tsx` with severity slider + photo. Symptom tab on Health renders flag chips and red-banner emergency CTA.
**Acceptance:** logging "vomiting blood, severity 5" → AI flags `emergency` → notification + red banner appears.

## Phase 18 — Walker trust gate (background check + quiz)
**Gap closed:** D. walker verification.
**Backend:** new `walker_profiles` (user_id, id_doc_url, id_doc_type, status `pending|approved|rejected`, quiz_score, quiz_attempts, approved_at). New `walker_quiz_questions` (admin-managed). RLS: walker reads own; admins read/update all. Trigger blocks `service_providers.category='dog_walker'` activation unless `walker_profiles.status='approved'`.
**Frontend:** `walker/Onboarding.tsx` — upload ID, take 10-question handling quiz (auto-graded). Admin tab "Trust" gets a Walkers sub-panel.
**Acceptance:** unverified walker cannot publish a walker service; after passing quiz + admin approval they can.

## Phase 19 — Recurring bookings
**Gap closed:** D. recurring bookings.
**Backend:** new `recurring_bookings` (customer_id, provider_id, pet_id, rrule, time_of_day, duration_min, price_inr, active, next_run_at, created_at). pg_cron job runs `recurring-booking-spawn` daily — materializes the next concrete `service_bookings` row 24h ahead.
**Frontend:** booking sheet adds "Repeat" toggle (daily / weekdays / custom days). Owner & provider see a "Recurring" section in their bookings list with pause/cancel.
**Acceptance:** create "every weekday 7am walk" → next morning a `service_bookings` row exists → cancel recurring → no more spawns.

## Phase 20 — Mating listing fee (₹500)
**Gap closed:** A. paid listing fee.
**Backend:** add `paid_listing_id`, `paid_until` to `mate_listings`. Reuses existing `create-one-time-checkout`. Stripe webhook on success sets `paid_until = now()+30d`.
**Frontend:** `MatesNew.tsx` posts as `draft`, shows "Publish for ₹500 (30 days)" → checkout → on return listing flips to `active`. Visible mate listings filter `paid_until > now()`.
**Acceptance:** unpaid drafts hidden; paid listings expire after 30d (cron flips to `expired`).

## Phase 21 — Missing-pet premium boost (₹499, no escrow yet)
**Gap closed:** F. paid premium listing.
**Backend:** add `boosted_until` to `missing_pets`. Reuses one-time checkout. Cron flips back at expiry.
**Frontend:** "Boost reach (₹499)" button on missing pet detail. Boosted alerts fan out to **15 km** instead of 5 km and pin to top of `MissingFeed`.
**Acceptance:** boost a pet → fan-out radius widens, pin appears, expires after 7 days.

## Phase 22 — Health AI insights surface
**Gap closed:** B. weight-trend / diet-correlation insights surface.
**Backend:** new edge function `health-insights` (gpt-5-mini) returns JSON `{trends, correlations, recommendations}` from last 90 days; cached in `health_insights` table per pet, refreshed weekly via cron.
**Frontend:** new "Insights" tab on Health page with charts (weight trend, food-vs-symptom correlation cards). Plus-tier gate: free shows 1 insight, Plus shows all.
**Acceptance:** a pet with weight + nutrition data shows at least one rendered insight; non-Plus user sees lock on extra cards.

## Phase 23 — NGO donations + featured adoption
**Gap closed:** H. donate + featured adoption.
**Backend:** add `accepts_donations`, `donation_url`, `featured_until` to `profiles` (org rows). Reuses one-time checkout for in-app donations (records in `donations` table: donor, org, amount, stripe_session_id).
**Frontend:** Donate button on shelter `OrgProfile.tsx`. Admin can mark org `featured_until` from Org Review. Adopt page sorts featured first.
**Acceptance:** donor pays ₹100 → row in `donations` → org sees a Donations tab with totals.

## Phase 24 — Shop contextual purchase reminders
**Gap closed:** I. contextual purchase reminders.
**Backend:** cron `shop-reorder-scan` daily — for each pet with a recent `nutrition_logs.brand`, computes daily portion (weight × factor), compares to last `shop_orders` of that brand, projects depletion date, writes a `proactive_alerts` row 5 days before.
**Frontend:** the alert card from Phase 16 deep-links into Shop search prefilled with the brand.
**Acceptance:** logged daily 200g of "Brand X" + last order 30 days ago → alert fires "Max's food runs out Friday — reorder".

## Phase 25 — Pregnancy tracker
**Gap closed:** A. pregnancy tracker.
**Backend:** new `pregnancies` (dam_pet_id, sire_pet_id NULLABLE, mating_request_id, started_on, expected_whelp, status `active|whelped|lost`, notes). New `pregnancy_milestones` (week, title, ai_tip). Auto-create when a `mating_request.status='agreed'` flips (trigger).
**Frontend:** "Pregnancy" panel on dam's profile shows week tracker, milestones, day-by-day tips. On whelp → CTA "Create litter" pre-fills `litter_groups`.
**Acceptance:** agreeing on a mating creates a `pregnancies` row; the dam owner sees a 9-week tracker with weekly tips.

## Phase 26 — Pickup/drop ("pet taxi" leg) for boarding
**Gap closed:** D. Uber-for-pets pickup/drop.
**Backend:** add `transport_legs` table (booking_id, kind `pickup|drop`, address, scheduled_at, status, fare_inr, driver_id NULL, started_at, ended_at). Reuses `walk_tracks` for live trace.
**Frontend:** boarding booking flow adds "Add pickup ₹X" + "Add drop ₹Y" toggles. Driver app surface (provider dashboard) shows "Start trip" button that opens `WalkLive` with the leg id. Owner sees live trace via existing public share token.
**Acceptance:** owner adds pickup → provider starts trip → owner sees live map → trip auto-ends when dropped.

## Phase 27 — Post-consult Rx deep-link to Shop
**Gap closed:** C. medicine deep-link.
**Backend:** new `consult_prescriptions` (appointment_id, vet_id, items jsonb [{name, dose, qty, sku?}]). RLS: vet writes for own appts, owner reads.
**Frontend:** vet `AppointmentRoom.tsx` adds "Add prescription" form. After call ends, owner sees "Buy meds" CTA → opens Shop with prefilled cart by SKU; unmatched items shown as "ask pharmacy" notes.
**Acceptance:** vet writes 2 items → owner sees both in cart with one tap.

---

# 🚪 STRIPE CONNECT GATE (Phase 28 — required for 29–34)

## Phase 28 — Stripe Connect onboarding
**Gap closed:** J. Connect accounts for all earners.
**Backend:** new `stripe_accounts` (user_id, account_id, type `express`, charges_enabled, payouts_enabled, country, status). New edge functions: `connect-onboard` (creates account + AccountLink), `connect-refresh`, `connect-webhook` (account.updated).
**Frontend:** new "Payouts" page reachable from vet, walker, boarder, breeder, NGO dashboards. Status pill (Pending / Verifying / Ready). Blocks "Accept paid bookings" toggle until ready.
**Acceptance:** test vet completes Express onboarding → returns to app → status flips to Ready → KYC stored.

## Phase 29 — Marketplace payouts on bookings
**Gap closed:** J. payouts to vets/walkers/boarders.
**Backend:** when `service_bookings.status` flips to `completed`, edge function `payout-booking` does Stripe Transfer of `price - platform_fee%` to the provider's connected account; writes `payouts` row. Platform fee per category (vet 20%, walker 15%, boarder 18%, grooming 15%).
**Frontend:** provider Earnings tab (lifetime, pending, paid).
**Acceptance:** booking marked completed → transfer executes in Stripe test → row in `payouts` → Earnings tab updates.

## Phase 30 — Puppy-sale commission + escrow
**Gap closed:** A. commission on puppy sales.
**Backend:** when buyer pays for an `adoption_listings` row of type `breeder_sale`, funds are held against platform account; on `transfer_confirmed` (buyer marks "puppy received") → 90% to breeder, 10% platform. Disputes lock funds for admin review.
**Frontend:** buyer/seller see escrow status timeline. Admin gets a Disputes panel.
**Acceptance:** complete sale → 90/10 split executes; raise dispute → funds frozen until admin resolves.

## Phase 31 — Missing-pet reward escrow + payout
**Gap closed:** F. reward escrow + finder payout.
**Backend:** add `missing_pet_rewards` (missing_pet_id, owner_id, amount_inr, stripe_pi_id, status `held|released|refunded`, finder_id). On `missing_pets.status='found'`, owner picks finder from sightings → release transfers reward minus 5% processing.
**Frontend:** "Pledge reward ₹X" on Missing detail. "Mark as found + choose finder" flow.
**Acceptance:** pledge ₹1000 → mark found + select finder → finder's Connect account receives ₹950.

## Phase 32 — Recurring shop orders
**Gap closed:** I. subscription / recurring shop orders.
**Backend:** Stripe Subscription with shipping interval; new `subscription_orders` table mirrors each cycle's fulfillment. Cron `subscription-fulfill` creates the next `shop_orders` row.
**Frontend:** product page adds "Subscribe & save 10% — every 30/45/60 days". Manage in Plus/Subscriptions page.
**Acceptance:** subscribe to food → next month a shop_orders row auto-creates and customer is charged.

## Phase 33 — Diet-plan marketplace
**Gap closed:** B. diet-plan marketplace.
**Backend:** `diet_plans` (author_vet_id, title, price_inr, body_md, species, age_band). `diet_plan_purchases` (buyer, plan, stripe_pi_id). Vet keeps 80%.
**Frontend:** vet authoring page + Health page "Diet plans" tab to browse/buy.
**Acceptance:** vet publishes ₹299 plan → owner buys → vet's Earnings shows ₹239.

## Phase 34 — GPS tracker monthly subscription billing
**Gap closed:** E. device subscription billing (data model still pending — see Phase 35).
**Backend:** Stripe recurring price ₹199/month tied to a `gps_devices` row. Webhook flips `gps_devices.subscription_status`.
**Frontend:** "Subscribe" button on device detail.
**Acceptance:** activate subscription in test → status flips, monthly invoice cycles.

---

# 🛠 HARDWARE GATE (Phases 35–37)

## Phase 35 — GPS device data model + live ingestion
**Backend:** `gps_devices` (id, owner_pet_id, device_serial, last_seen_at, last_lat, last_lng, battery, subscription_status). `gps_device_pings` (device_id, lat, lng, recorded_at, battery). Edge function `gps-ingest` (HMAC-signed POST from device). RLS: only owner reads own device data.
**Frontend:** "Devices" tab in Settings with pair-by-serial flow + live map of last ping.
**Acceptance:** simulated POST → ping stored → map updates within seconds via realtime.

## Phase 36 — Geofence + alerts
**Backend:** `geofences` (device_id, name, center_lat, center_lng, radius_m, active). On every ping a trigger checks distance and writes notification + push if `outside`.
**Frontend:** draw geofence on a map; receive push when pet leaves.
**Acceptance:** simulated ping outside circle → push fires within seconds.

## Phase 37 — Hardware SKU in Shop
**Backend:** flag `shop_products.kind='gps_device'`; on order completion auto-creates a `gps_devices` row tied to a serial assigned by admin from inventory.
**Frontend:** product page with the device SKU; post-purchase flow asks owner to pick the pet to assign.
**Acceptance:** purchase → `gps_devices` row appears in owner's Devices tab.

---

# Per-phase definition-of-done checklist (applies to EVERY phase)

```text
[ ] Migration: tables + enums + indexes + RLS + triggers + seeds
[ ] Edge function (if any): CORS, JWT validation in code, zod input
[ ] Cron registered (if applicable) via insert tool, not migration
[ ] Frontend page/component created with semantic tokens (no raw colors)
[ ] Wired to existing nav (Home / Health / Admin / etc.)
[ ] Notifications + push fire where the spec says they should
[ ] Realtime subscription where the user expects live updates
[ ] Plus-tier gating respected via current_tier()
[ ] Manual smoke test against acceptance criteria above
[ ] No supabase linter errors INTRODUCED by this phase (pre-existing OK)
```

---

# Credit-saving rules I will follow

1. **One phase per approval** — I will not chain phases without a green light.
2. **Migrations only when schema changes** — data ops use the insert tool.
3. **Reuse before build** — every phase reuses existing infra (`current_tier`, `notify_user`, `walk_tracks`, `create-one-time-checkout`, `proactive_alerts`) and never duplicates it.
4. **No speculative UI** — components only where the acceptance criterion needs them.
5. **No re-touching shipped phases** unless the gap list explicitly says so.

---

## Recommended start order (my pick, you can override)

1. **Phase 16** (proactive alerts) — biggest UX win, zero billing risk, foundation for Phase 24.
2. **Phase 20** (mating listing fee) — instant revenue, no Connect needed.
3. **Phase 17** (symptom diary v2) — safety + retention.
4. **Phase 18 → 19** (walker trust, recurring) — locks in marketplace quality.
5. Then go through the rest top-to-bottom.

When you approve, tell me the phase number and I'll ship just that one — fully wired, end to end, real and working.
