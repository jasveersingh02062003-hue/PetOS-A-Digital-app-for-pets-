
# Phase K — "Nearest + Live" everywhere (wiring sprint)

A lot of the underlying infrastructure for "Zomato-style" Petos already exists:

| Already shipped | Where |
|---|---|
| `discover_providers / discover_mating_listings / discover_shop_products / discover_pets_for_adoption` (composite_score = distance + rating + freshness) | `supabase/migrations/20260430074756…` |
| `nearby_providers / nearby_vets / nearby_meetups / nearby_missing` (radius RPCs) | `…20260428112145…` |
| Missing-pet 5 km fanout via `enqueue_missing_pet_alerts` → `notification_jobs` → `process-notification-jobs` edge fn → `send-push` | `…20260429054704…` |
| Walker live GPS, taxi bidding + arrival geofence (200 m), live driver map | Phase I/J |
| `useUserLocation`, `useNearbyQuery`, `<DistanceChip>`, `<NearMePanel>`, `<LeafletMap>` | `src/hooks/`, `src/components/` |
| Already nearest-aware: Adopt hub, Service hub, Mates grid, Shop, Breeders, Search ("Best matches" via `search_entities`), TaxiInbox, MissingFeed (radius pills) | last sprint |

This phase **wires that infra into the remaining list pages** and adds the few "alive" UI touches still missing — no new heavy infra, no new edge functions, no rewrites.

---

## What changes (10 small, surgical edits)

### 1. Meetups list — nearest-first + distance chip + live RSVP count
File: `src/pages/Meetups.tsx`
- When `coords` available, fetch via `supabase.rpc("nearby_meetups", { _lat, _lng, _radius_km: 50 })` instead of city-only `useUpcomingMeetups`.
- Show `<DistanceChip>` per `<MeetupCard>` (pass `distanceKm` prop; add prop to `MeetupCard`).
- Subscribe to `meetups` table changes (INSERT/UPDATE) → invalidate query so a new meetup or RSVP appears live.
- Add a "Within 5/10/25/50 km · Anywhere" radius rail (reuse the same chip pattern as MissingFeed).

### 2. MissingFeed — switch radius filter to the server RPC
File: `src/pages/MissingFeed.tsx`
- Already has client-side haversine + radius pills. Replace the `from("missing_pets").select(...)` path with `supabase.rpc("nearby_missing", { _lat, _lng, _radius_km })` when `coords && radiusKm !== "all"` so the server returns pre-filtered, distance-sorted rows and we stop pulling 50 rows just to discard most.
- Keep the "Anywhere" branch unchanged for users who deny location.
- Realtime channel already in place — no change needed.

### 3. Vet portal — add a "🚨 Find nearest open vet" entry for owners
File: `src/pages/VetTriage.tsx` (already the "ask a vet" entry) and `src/pages/Vet.tsx` (vet-side dashboard, untouched).
- After the AI severity classifier returns `moderate|severe`, render a new `<NearestVetCta />` component that calls `nearby_vets({_lat,_lng,_radius_km:25})`, sorts by `distance_km`, and shows the top 3 with: name, clinic, distance, "Call" + "Get directions" + "Book video".
- New component: `src/components/vet/NearestVetCta.tsx` (~80 LOC, no new RPC needed).

### 4. Shelters page — nearest-first + live "in care" count
File: `src/pages/Shelters.tsx`
- Order shelters by client-side haversine on `org_profiles.lat/lng` (or fall back to alphabetical if no coords). Show `<DistanceChip>`.
- Subscribe to `pet_listings` INSERT/DELETE filtered to `org` owners → "live count" of animals in care updates without refresh.

### 5. Adoption application status — realtime updates
File: `src/pages/AdoptionInbox.tsx` + `src/pages/AdoptListingDetail.tsx`
- Add `postgres_changes` subscription on `adoption_applications` filtered by `application_id` / `listing_id` so status transitions (received → reviewing → approved → home_visit_scheduled) repaint instantly. The status column already exists; only the realtime listener is missing.

### 6. Discover — promote `<NearMePanel>` and add a "Near me" badge to service tiles
File: `src/pages/Discover.tsx`
- `<NearMePanel>` is already used on Discover; surface it higher (above tiles) when `coords` is fresh.
- For each service tile that has a `serviceKey`, asynchronously fetch a single-row count via `nearby_providers({_lat,_lng,_radius_km:10,_category:serviceKey})` and overlay a tiny pill: "12 nearby". Use `useQueries` so all tile counts run in parallel and share the same coords.

### 7. Booking lifecycle — animated status pill
File: new `src/components/booking/StatusProgress.tsx` (~50 LOC) used by `TaxiDetail`, `ServiceDetail` booking blocks, and `MyAppointments`.
- Pure UI: takes `status: 'requested'|'confirmed'|'on_the_way'|'in_progress'|'completed'` + the canonical `FLOW`, renders 5 dots with the active step pulsing (Tailwind `animate-pulse`) and a thin gradient bar between completed dots. No data layer changes — it just visualises whatever realtime status the page already subscribes to.

### 8. "Location updated" + "New near you" toasts
Files: `src/hooks/useUserLocation.ts` (no new file needed — extend) and `src/components/RealtimeBridge.tsx` (already mounted in `App.tsx`).
- When `useUserLocation` produces a fresh coord (≥ 5 min since last) trigger `toast("Location updated", { duration: 1500 })`.
- In `RealtimeBridge`, when a `missing_pets` INSERT arrives whose `last_seen_lat/lng` is within 10 km of the user's coords, fire a critical toast "🐾 Missing pet reported 2.1 km away" + a deep link to `/missing/:id`. (Push from server already handled via `send-push`; this is the in-app live equivalent.)

### 9. Empty-state nudge: "expand radius?"
File: `src/components/empty/EmptyState.tsx`
- Optional new prop `onExpandRadius?: () => void`. When present, render a secondary "Expand radius" button under the CTA. Used in MissingFeed/Meetups/Shelters when filtered results are empty but unfiltered would have results.

### 10. NearbyToggle component (consistency)
File: new `src/components/marketplace/NearbyToggle.tsx`
- The same chip the Mates grid + Breeders use today, extracted into one component so Meetups/Shelters/MissingFeed share one design — pill button, active state when location granted, disabled tooltip "Enable location" when not.

---

## What is intentionally NOT in scope

- No new edge functions, no VAPID changes — `send-push` + `process-notification-jobs` are already running.
- No PostGIS migration — the existing `earthdistance` + `cube` extensions back all `nearby_*` RPCs.
- No GPS tracker hardware (deferred per original spec).
- No new recommendation algorithm — `composite_score` (distance + rating + freshness + signal bonus) is already in the `discover_*` RPCs.
- No backfill of geocoded addresses for missing rows — existing rows without lat/lng simply fall back to city/recency sort.

---

## Files touched (all small)

```text
src/pages/Meetups.tsx                       (~rewrite list query, +radius rail)
src/pages/MissingFeed.tsx                   (swap to nearby_missing RPC)
src/pages/VetTriage.tsx                     (mount NearestVetCta on moderate+)
src/pages/Shelters.tsx                      (nearest sort + live in-care count)
src/pages/AdoptionInbox.tsx                 (+realtime sub)
src/pages/AdoptListingDetail.tsx            (+realtime sub for application row)
src/pages/Discover.tsx                      (lift NearMePanel + tile counts)
src/components/social/MeetupCard.tsx        (accept distanceKm prop, render chip)
src/components/RealtimeBridge.tsx           (in-app "missing pet near you" toast)
src/components/empty/EmptyState.tsx         (+onExpandRadius prop)
src/hooks/useUserLocation.ts                (toast on first/refresh)
src/components/vet/NearestVetCta.tsx        (NEW ~80 LOC)
src/components/booking/StatusProgress.tsx   (NEW ~50 LOC, pure UI)
src/components/marketplace/NearbyToggle.tsx (NEW ~30 LOC, refactor)
```

No SQL migrations. No edge function changes.

---

## Acceptance — what should visibly change

1. Open `/meetups` from Pune with location on → list is sorted nearest-first, every card shows `📍 1.2 km`, a 5/10/25/50 km radius rail at the top works, and a freshly-created meetup appears within ~1 s without a refresh.
2. Open `/missing` from Mumbai with `radius = 10 km` → only sightings within 10 km are returned by the server (network tab shows `nearby_missing` RPC), distance chip on every card.
3. From `/vet-triage` describe a "vomiting + lethargic" symptom → after AI says "moderate/severe" you see "Nearest open vets" with three cards (closest first, Call/Directions/Book buttons).
4. Start a taxi trip → status pill animates the active step; the same component is reused for service bookings and appointments.
5. Toggle location off in browser → all "nearest" toggles disable with a tooltip and lists fall back gracefully (no errors, no empty list).
6. While the app is open, another tester reports a missing pet within 10 km of you → a critical in-app toast appears with a deep link, and the standard push fires too.

Reply **"Go"** to ship Phase K.
