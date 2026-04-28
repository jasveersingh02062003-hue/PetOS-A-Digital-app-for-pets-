# Wave 8.5 — Polish: Maps everywhere, Live walk sharing, "Not a Google Form" UX

## Audit of what's already done (no rework needed)

Wave 8 already delivered the core. Verified in code:

- **Leaflet wrapper** `src/components/maps/LeafletMap.tsx` — markers, popups, polyline, color pins, `followLast` auto-pan.
- **Walk tracking** `src/pages/WalkSession.tsx` — realtime channel on `walk_tracks`, live polyline, distance (haversine), Start/End for provider, customer view, route `/walk/:id`.
- **Geo radius search** — `nearby_vets`, `nearby_providers`, `nearby_missing`, `nearby_meetups` RPCs (using `earthdistance`/`cube`, which is functionally equivalent to PostGIS `ST_DWithin` for our needs — no need to add PostGIS too, would duplicate).
- **NearMePanel** wired into Discover.
- **Onboarding/AboutYou** capture lat/lng.
- **Admin panel** at `/admin` with Reports / Vet Apps / Providers / Users tabs (role-gated via `user_roles`).

So this wave is **polish + the truly missing pieces** from your spec, not a rebuild.

## What this wave will add

### 1. Interactive maps in remaining detail pages
Replace static "city text + MapPin icon" placeholders with real `LeafletMap` blocks (no iframes exist anymore — they were removed in Wave 8):
- `MissingDetail.tsx` — already uses LeafletMap, add **marker clustering** via `leaflet.markercluster` when sightings > 10.
- `MeetupDetail.tsx` — add map showing meetup `lat/lng` with venue popup.
- `ServiceDetail.tsx` — add map showing provider location with name + rating popup.
- `MissingNew.tsx` (create flow) — add a tap-to-pin map so owners set last-seen location precisely instead of relying on browser GPS.
- All use a small dog-paw SVG `divIcon` for brand consistency.

### 2. Public live walk share
- New route `/walk-live/:bookingId` (page `src/pages/WalkLive.tsx`) — read-only map, no auth required, RLS-safe via a `public_share_token` column on `service_bookings` (link includes token).
- Migration: add `public_share_token uuid` to `service_bookings` + a `SECURITY DEFINER` RPC `get_public_walk(_token uuid)` returning latest tracks/polyline only.
- "Share live walk" button in `WalkSession.tsx` copies the link via `navigator.clipboard`.

### 3. Owner live view inside booking
- BookingDetail page doesn't exist as its own route; the customer currently lands on `/walk/:id`. We'll add a banner "Live walk in progress" on the customer's `Orders`/services list that deep-links into `/walk/:id` when a booking is `in_progress`.

### 4. Geofenced missing-pet notifications (radius, not just city)
- New trigger / job: when a `missing_pets` row is created with `last_seen_lat/lng`, insert into `notification_jobs` with payload including coords + 5 km radius.
- Update existing `notify_missing_pet_alerts` (currently city-string match) to also fan out to profiles within 5 km using `earth_distance`.

### 5. "Not a Google Form" UX polish
Sweep for missing feedback. Concretely:
- Add a shared `<EmptyState illustration cta />` component and replace the 6 worst "Nothing here yet" strings (Home feed empty, Discover empty, Health vault empty, Missing feed empty, Services empty, Notifications empty).
- Add `loading` state to all primary action buttons that currently call mutations without a spinner (audit list: Composer post, Mating request send, Booking confirm, Vet apply submit, Prescription save, Missing alert create).
- Add `navigator.vibrate(10)` helper `src/lib/haptics.ts` and call from: like, follow, RSVP, booking, send-message.
- Skeleton loaders: add to PostFeed (already has?), HealthTimeline, ServiceList, VetList — use existing `Skeleton` shadcn component.

### 6. Realtime sanity pass
Verify channels & cleanup on: `posts`, `post_comments`, `post_reactions`, `stories`, `notifications`, `mating_messages`, `appointments`, `walk_tracks`. Add any missing `removeChannel` cleanup in useEffect returns. Add `ALTER PUBLICATION supabase_realtime ADD TABLE …` for any table not yet in the publication.

## Files

**New**
- `src/pages/WalkLive.tsx` — public live walk viewer
- `src/components/empty/EmptyState.tsx` — reusable illustrated empty state
- `src/lib/haptics.ts` — `vibrate()` helper
- `src/components/maps/PawMarker.ts` — paw `divIcon` factory

**Edited**
- `src/components/maps/LeafletMap.tsx` — accept custom icon prop, optional clustering flag
- `src/pages/WalkSession.tsx` — add Share button + paw marker
- `src/pages/MeetupDetail.tsx`, `src/pages/ServiceDetail.tsx`, `src/pages/MissingDetail.tsx`, `src/pages/MissingNew.tsx` — embed interactive maps
- `src/pages/Home.tsx`, `src/pages/Discover.tsx`, `src/pages/MissingFeed.tsx`, `src/pages/Notifications.tsx`, `src/pages/HealthVault.tsx`, `src/pages/Services.tsx` — EmptyState
- `src/components/Composer.tsx`, `src/components/vet/PrescriptionBuilder.tsx`, `src/pages/MissingNew.tsx`, `src/pages/VetApply.tsx` — button loading states
- `src/App.tsx` — add `/walk-live/:token` route

**Migrations**
- Add `public_share_token uuid` to `service_bookings` + `get_public_walk(_token)` RPC
- Replace `notify_missing_pet_alerts` with radius-aware version (5 km)
- Add `leaflet.markercluster` already in package.json — no install needed
- `ALTER PUBLICATION supabase_realtime ADD TABLE` for any missing tables

## Out of scope (explicit)
- **PostGIS** — current `earthdistance` solution covers all stated needs; adding PostGIS too would be redundant and slower migrations.
- **Web push (FCM/APNs)** — deferred to Wave 10 per your earlier roadmap.
- **Allergy filter & affiliate codes** — Wave 12.
- **Drag-to-refresh** — needs a touch gesture lib; defer unless you want it now.

## After build — manual test checklist
1. Walker hits Start, customer's `/walk/:id` shows polyline growing in real time without refresh.
2. Click "Share live walk" → paste in incognito → map loads with no auth.
3. Create missing alert with GPS → another account within 5 km gets in-app notification.
4. Open MeetupDetail / ServiceDetail / MissingDetail → see interactive Leaflet maps with popups.
5. Empty Home feed shows illustrated CTA, not bare text.
6. Composer "Post" button shows spinner while saving.

Reply **"go"** to implement.
