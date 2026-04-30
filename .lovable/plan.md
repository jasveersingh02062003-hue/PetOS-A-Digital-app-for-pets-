# Sprint M — Close the "Nearest + Live" Gaps

Goal: turn the audit's ⚠️/❌ items into ✅, organized into 4 small, shippable phases. Each phase is independently deployable so the app stays working between phases.

---

## Phase M1 — Booking lifecycle feels alive (1 deploy)

The `<StatusProgress />` component already exists but is unused. Wire it into every booking surface so users see the same Zomato/Swiggy-style animated progress everywhere.

Work:
- Add `<StatusProgress />` to:
  - `TaxiDetail.tsx` — steps: requested → accepted → arriving → in_progress → completed (driven by `transport_bookings.status` + `transport_legs`).
  - `AppointmentRoom.tsx` (vet) — steps: scheduled → checked_in → in_progress → completed (driven by `appointments.status`).
  - `WalkSession.tsx` — steps: confirmed → on_the_way → in_progress → completed (driven by booking + presence of recent `walk_tracks`).
  - New booking detail page `BookingDetail.tsx` for generic `service_bookings` rows (route `/bookings/:id`), reachable from `MyAppointments.tsx` and the walker accepted-job push deep link.
- Make all four use a single `useBookingStatus(bookingId)` hook subscribing to the relevant `postgres_changes` channel so the progress bar animates without refresh.
- Add a "Live" pulsing dot beside the progress when in-progress.

User-visible result: every booking now shows an animated 4-5 step progress bar that updates in real time without reloading.

---

## Phase M2 — Nearby fanout + Vet directory + Mates live (1 deploy)

Make new local listings push to nearby users and give vets a proper directory.

Backend (one migration):
- Generic helper: `public.fanout_nearby(_actor uuid, _lat double precision, _lng double precision, _radius_km int, _kind text, _payload jsonb)` — finds users within radius (using `profiles.lat/lng` + `haversine_km`) and inserts into `notification_jobs` so the existing `tg_notifications_send_push` + `send-push` edge function delivers them.
- Triggers wiring:
  - `tg_mate_listing_nearby` AFTER INSERT on `mate_listings` (status='active') → fanout 25 km.
  - `tg_pet_listing_nearby` AFTER INSERT on `pet_listings` (purpose='adopt') → fanout 25 km.
  - `tg_provider_nearby` AFTER INSERT on `service_providers` (active=true) → fanout 15 km.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.mate_listings;` so clients can listen live.

Frontend:
- `RealtimeBridge.tsx`: add a second `mate_listings` listener that toasts "New {breed} {sex} {distance}km away" when within 25 km of `useUserLocation`.
- `MatesGrid.tsx`: invalidate `discover_mating_listings` query on `mate_listings` postgres_changes for instant grid refresh.
- New `src/pages/Vets.tsx` (route `/vets`):
  - Uses `nearby_vets` RPC.
  - Filters: specialty chips (general/dermatology/surgery/etc.), "Open 24/7" toggle, "Open now" toggle (from `clinic_hours` if present, else hide), `<NearbyToggle />`.
  - Each row: avatar, name, specialty, distance chip, "Book" + "Directions" buttons.
  - Add nav entry in `Discover.tsx` and a "See all vets" link inside `<NearestVetCta />`.
- `Breeders.tsx`: surface `last_sign_in_at`-derived "Active 2h ago" and computed `response_rate_pct` (accepted_requests / total_requests) — both already inferable from existing tables; add a tiny SQL view `breeder_stats` to keep the query cheap.

User-visible result: open the app in Mumbai, someone lists a Lab stud 4 km away → instant toast + the mates grid updates without refresh. Tap "Vets" to see the closest clinics with 24/7 and specialty filters.

---

## Phase M3 — Provider richness + Shop ETA + Order tracking (1 deploy)

Backend:
- `service_providers.service_radius_km` column (int, default 10) — already nullable-safe.
- `orders.shipment_status` enum (`pending|packed|shipped|out_for_delivery|delivered`), `orders.tracking_url`, `orders.shipped_at`. Add `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;`.
- Tiny RPC `estimate_delivery(_pincode text, _seller_lat numeric, _seller_lng numeric)` returning `{eta_days_min, eta_days_max, distance_km}` using a pincode→lat/lng lookup table (`pincodes(pincode pk, lat, lng, city, state)`); seed for India top-50 cities to start, gracefully fallback to "3-5 days" when unknown.

Frontend:
- `ServiceDetail.tsx`:
  - Draw a translucent radius circle on the `<LeafletMap>` using `service_radius_km`.
  - Compact 7-day availability strip pulled from `provider_slots` (already exists). Empty days greyed; tap a day to see slot times.
- `Shop.tsx` product card: "Delivers to {pincode} in 2-3 days" once the user enters a pincode (stored in `localStorage` + on profile).
- `Checkout.tsx`: pincode field with live ETA pill above "Place Order".
- `Orders.tsx`: realtime subscription to `orders`; show `<StatusProgress />` for shipments using the new enum.

User-visible result: provider page shows the area they cover; checkout shows real ETA based on your pincode; orders page updates the moment the seller marks it shipped.

---

## Phase M4 — Smarter pushes (1 deploy)

Backend:
- `appointment_reminders` cron via `pg_cron` + `pg_net` calling a new edge function `appointment-reminders` every 5 min that finds `appointments` starting in 25-35 min and inserts `notification_jobs` rows. (Insert SQL via the insert tool, not migration, because it embeds the project URL + anon key.)
- New edge function `supabase/functions/appointment-reminders/index.ts` (CORS, JWT-validated via service role).

Frontend:
- `RealtimeBridge.tsx`: when a `notifications` row of kind `job_accepted` arrives, deep-link the toast action to `/bookings/:id` (the new detail page from M1) so "Walker accepted" pushes go straight to the live map.

User-visible result: 30 minutes before a vet visit, the user gets a push reminder; tapping a "Walker accepted" notification jumps directly into the live tracking map.

---

## Out of scope for this sprint (audit items 8-10)

- Local breed-club suggestions in `Groups.tsx` — small, can ship in a follow-up.
- Geofence + family sharing for GPS tracker — needs hardware roadmap call.
- Playdate planner — needs UX design first.

These stay queued; everything else from the audit moves to ✅ after M1-M4.

---

## Technical notes (for reviewers)

- All new SQL goes through one migration per phase except the cron job (insert tool).
- No edits to `src/integrations/supabase/{client,types}.ts` — types regenerate after each migration.
- Reuse existing primitives: `useNearbyQuery`, `useUserLocation`, `<DistanceChip />`, `<NearbyToggle />`, `<StatusProgress />`, `notify_user`, `notification_jobs`, `send-push`. No new infra concepts.
- Risk: nearby fanout could be noisy. Throttle by capping each `fanout_nearby` call to 500 recipients and dedupe via a `notification_jobs.dedupe_key` so the same listing can't fan out twice.
- All RLS policies on new columns/tables follow the existing pattern (owner read/write, public read where the parent row is public).

Reply **"go M1"** (or "go all" to ship M1-M4 back-to-back).