# Petos — Gap-Closure Plan (Phases F → L)

Goal: take every 🟡 PARTIAL and ❌ MISSING item from the reality check and ship them in **7 self-contained phases**. Each phase is fully wired front-end + back-end + RLS + edge functions before moving on. No re-visits.

---

## Phase F — Universal OTP & Intent-Replay (the funnel backbone)

Make the "1 action → invisible account → resume" loop work everywhere, not just contact-seller.

**Backend**
- Migration: extend `intent_replays` enum to cover `book_service`, `donate`, `apply_to_adopt`, `taxi_post`, `subscribe_missing_alert`, `shop_checkout`, `vet_book`, `report_sighting`.
- RLS: allow anonymous INSERT into `missing_pet_sightings` with rate-limit trigger (mirror `anon_reports`).
- Edge function `otp-send-sms` (uses Supabase phone OTP via `signInWithOtp({ phone })`) — provider: Twilio connector if user adds, else inform.

**Frontend**
- `ContactSellerSheet.tsx` → add **email/phone toggle**, call `signInWithOtp` accordingly.
- New `<OtpGate>` wrapper component re-used by:
  - `AdoptionApplicationSheet` (apply-to-adopt anon)
  - `DonationCheckout` (anon donate)
  - `BookingSheet` (vet/walker/kennel anon book)
  - `TaxiPostSheet` (anon post taxi need)
  - `MissingAlertSubscribe` (anon alert opt-in)
  - `ShopCheckout` (anon buy)
  - `SightingReportSheet` (anon "I saw this pet")
- `useIntentReplay`: add handlers for each new intent type; auto-seed first chat message where applicable.
- Post-verify redirect wired into all 8 flows above.

**Acceptance**: anonymous user can complete every action with email OR phone, lands back on the exact same screen authed, nothing re-typed.

---

## Phase G — Hub Filters, Geo & Sort (discovery polish)

**Backend**
- Add `is_open_now(provider_id)` SQL function reading `provider_hours` table (create if missing: `provider_id, weekday, open_time, close_time`).
- Add `service_area_radius_km` + `service_area_geom` (PostGIS point) to `providers`.

**Frontend**
- `<GeoBanner>` on `AdoptCategory` and `ServiceCategoryCity`: "Showing Pune · Change" → city sheet (uses existing `useGeoCity`).
- `ListingFilters.tsx`: add **Open Now** toggle, **Mating only** toggle (adopt hub), **Soonest available** sort (walker/vet hubs using `next_available_at`).
- `ProviderWizard`: add **map draw** for service area (Leaflet circle on city center, radius slider).

**Acceptance**: every story-doc filter exists and changes results live.

---

## Phase H — Push, Email & PWA Activation  ✅ shipped (pending user action for VAPID + email domain)

Done in this pass:
- Branded PWA icons at `/icons/icon-192.png`, `/icons/icon-512.png` (any+maskable), `/icons/apple-touch-icon.png`; `manifest.webmanifest` and `index.html` updated.
- DB trigger `trg_notifications_send_push` on `public.notifications` → POSTs every new in-app notification to the existing `send-push` edge function via `pg_net`. All 19 notification triggers now deliver real Web Push automatically (graceful no-op if VAPID is unset).
- Realtime enabled on `public.reviews`; `useSellerTrust` resubscribes per seller and refetches the trust RPC on each new review → live trust counter.

Still requires user action:
- Add `VITE_PUBLIC_VAPID_KEY` (frontend env) + `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (edge secrets) to actually deliver push payloads.
- Configure email sender domain → then scaffold transactional + auth email templates (`new-message`, `booking-confirmed`, `walk-summary`, `donation-receipt-80g`, `adoption-application-received`, `sighting-near-you`).

Original spec retained below for reference:

**Backend**
- Generate VAPID keys, store as secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`); set `VITE_PUBLIC_VAPID_KEY`.
- Wire `send-push` to triggers via DB hooks: new message, walk update, booking status change, missing-pet sighting, taxi bid received.
- Run `email_domain--setup_email_infra` + `scaffold_transactional_email` + `scaffold_auth_email_templates`.
- Templates: `new-message`, `booking-confirmed`, `walk-summary`, `donation-receipt-80g`, `adoption-application-received`, `sighting-near-you`.

**Frontend**
- Replace `placeholder.svg` PWA icons with real branded 192/512/maskable icons.
- Push opt-in chip in `InstallNudgeSheet`; permission flow + token stored to `push_subscriptions`.
- Trust counter: subscribe to `seller_trust` realtime channel (broadcast on review insert) for live update.

**Acceptance**: real push lands on installed PWA; auth + transactional emails branded; install banner not broken.

---

## Phase I — Cross-Actor Workflows (Walker→Vet, Rx→Shop, Sitter→Owner)

**Backend**
- New table `walk_events` (`walk_id, type ENUM(health_flag, behavior_note, photo, geo_ping), payload jsonb`).
- Trigger: `health_flag` insert → notification + suggested vet booking row in `booking_suggestions`.
- New table `prescription_reorders` linked to `prescriptions`; cron edge function `rx-reorder-scan` (daily) inserts shop reminders 7 days before refill.
- New table `wellness_checks` for caretakers (5-question daily form).
- Trigger: caretaker daily-report insert → push to owner.

**Frontend**
- WalkSession: "Flag health issue" button → opens `walk_events` flag sheet → owner gets push + 1-tap "Book vet".
- Owner home: **Booking Suggestions** card.
- Caretaker dashboard: **Daily Wellness** form + auto-prompt at 9am local.
- Rx page: shows next reorder date + "Order again" CTA pre-filled in shop cart.

**Acceptance**: limp during walk → vet appointment in 3 taps. Rx → cart with right item next refill cycle.

---

## Phase J — Taxi Bidding, Geofencing & Live Tracking

**Backend**
- Migration: `taxi_bids` (`post_id, driver_id, price, eta_min, status, created_at`); RLS allows drivers to bid, post owner to accept.
- Migration: `taxi_locations` (`trip_id, driver_id, geom, recorded_at`) — realtime publication enabled.
- Edge function `taxi-geofence-check` (cron 30s) → push when driver enters dest city polygon.

**Frontend**
- `TaxiDetail` rebuild: bid list, accept-bid CTA, live Leaflet map subscribing to `taxi_locations`, ETA chip.
- Driver app screen: incoming requests list + **bid sheet**.
- Kennel pickup: same live-map component re-used for driver tracking.

**Acceptance**: post taxi → multiple driver bids → accept → live tracking + arrival push.

---

## Phase K — Trust, Tips, Escrow & Receipts

**Backend**
- Trust tiers: extend `seller_trust` RPC to compute tier (`new`, `rising`, `top_sitter` ≥50 visits, `verified_pro`).
- New columns on `providers`: `background_check_verified_at`, `insurance_verified_at`.
- `tips` table (`booking_id, payer, amount, currency`).
- Escrow: `provider_payouts.status` flow (`held → released_at`); cron `payout-release-scan` weekly releases held funds older than 7 days post-completion.
- Donations: edge function `generate-80g-pdf` (Deno + pdf-lib) → stores in `donation_receipts` bucket → emails via transactional pipeline.

**Frontend**
- Trust badges on `<TrustSignals>`: "Top sitter", "Background-check verified", "Insurance verified".
- WalkLive end-screen: **Tip $2 / $5 / Custom** chips.
- Donation flow: success page shows "Receipt emailed" + download link.
- Provider settings: upload background-check + insurance docs (admin verifies in dashboard).

**Acceptance**: badges render; tips post; weekly auto-payout works in test mode; 80G PDF arrives by email.

---

## Phase L — Org/Shelter Tooling & Onboarding Polish

**Backend**
- CSV import edge function `org-bulk-import-listings` (parses CSV → inserts adopt listings under org).
- `success_stories` table (`org_id, listing_id, adopter_name, story, photo_url, created_at`).
- Org stats RPC: animals_in_care, adopted_this_month, donations_this_month.
- Trigger: first photo upload on a pet-less account → forces pet-creation modal.

**Frontend**
- `OrgProfile`: stats banner, success-story feed, bulk-import CTA on org dashboard.
- New `<PetCreationGuard>` wrapping photo-post screens.
- `RecurringBookings`: add **"Make this recurring (6 weeks)"** chip on booking-success screen.
- Mating-match alert chip on `MateListing` opt-in for buyers.
- `AdoptListingDetail`: "Apply to adopt" sheet now supports anon via OtpGate (Phase F dependency).

**Acceptance**: shelter uploads 30 dogs via CSV; success stories appear; first-photo flow forces pet creation; recurring 2-tap upgrade works.

---

## Cross-Phase Technical Notes

- All new tables ship with RLS + policies in the same migration.
- All new edge functions get CORS + zod input validation + JWT check where needed.
- All new client features get loading/empty/error states + mobile-first 393px layout.
- Each phase ends with a smoke-test checklist run by me (anon → action → resume → notify).

## Suggested Execution Order

F → G → H run in parallel-ready order (F unblocks J, K, L). Recommended sequence:
**F → H → G → I → J → K → L** (funnel first, then notifications so later phases can fire pushes/emails as they're built).

## Approval

Reply **"Go"** and I'll start at Phase F and ship straight through to L without stopping for confirmation between phases.
