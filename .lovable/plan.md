
# Phase J — Live everywhere + Bidding (Zomato/Swiggy feel)

Two parallel workstreams. Both ship in this phase. Both are real, end-to-end.

---

## Part 1 — Pet Taxi: real driver bidding + live ETA

The current taxi flow only supports one assigned driver. We'll let any nearby driver place a bid; the customer picks the best one.

### What the user feels

```text
Customer posts trip ──► broadcasts to drivers within 15 km
   │
   ▼
Customer screen (live):              Driver screen (live):
┌─────────────────────────┐          ┌────────────────────┐
│ 3 drivers bidding…      │          │ New trip near you  │
│ ─────────────────────── │          │ Pickup: Koregaon   │
│ Ramesh · ★4.8 · 1.2 km  │          │ Drop: Kothrud      │
│ ₹280 · ETA 6 min  [✓]   │          │ Distance: 1.2 km   │
│ Suresh · ★4.5 · 2.1 km  │          │ [Bid ₹___ ETA __m] │
│ ₹250 · ETA 9 min  [✓]   │          └────────────────────┘
└─────────────────────────┘
```

When the customer accepts a bid, that driver becomes the assigned `provider_id` on the existing `transport_bookings` row and the existing live-tracking flow takes over. No duplication.

### Data

- New `taxi_bids` table: `booking_id, driver_provider_id, driver_user_id, price_inr, eta_minutes, distance_km, status (open/accepted/rejected/withdrawn), created_at`.
- RLS:
  - Drivers can `INSERT` for trips in `requested` state, only as themselves.
  - Drivers can `SELECT/UPDATE` their own bids.
  - Customer can `SELECT` all bids on their own trip + `UPDATE` to accept (which triggers).
- Realtime publication enabled on `taxi_bids`.
- Trigger on accept: sets the chosen `provider_id` on `transport_bookings`, marks status `accepted`, marks all other bids `rejected`, fires notifications to chosen + losing drivers.

### Geofencing & arrival push

- New SQL function `transport_arrival_check()`: when `driver_lat/lng` updates and the driver is within 200 m of pickup or drop-off, insert a `notifications` row with appropriate copy. The Phase H bridge auto-pushes it. No new edge function needed.
- Wire this into the existing `update_driver_location` RPC.

### UI

- `TaxiDetail.tsx` (customer view, status `requested`): live `<BidsList>` subscribing to `taxi_bids` for this booking — sorted by composite score (price + ETA + driver rating). Each row has Accept.
- New `<DriverInbox>` screen at `/driver/taxi`: realtime list of nearby `requested` trips for any provider whose category includes `pet_taxi`. Card shows distance from driver to pickup; tap → `<PlaceBidSheet>` with price + ETA inputs. Uses driver's last known geolocation.
- A `pet_taxi` quick-link on provider home if the provider has that category.

---

## Part 2 — App-wide "nearest + most relevant first" (the Zomato/Swiggy feel)

Today, most lists fetch by `created_at desc` or `city` text-equality. We make every discovery surface return results sorted by a **relevance score** that combines:

1. **Distance** from the user's current location (haversine, km).
2. **Quality** (rating, review count, verified flag).
3. **Recency / freshness** (decays older listings).
4. **Availability** (open-now boost where applicable).

### Where it ships

| Surface | Sort by |
|---|---|
| Service category (vet/walker/groomer/sitter/trainer/pet-taxi) | distance · rating · open-now · response time |
| Adopt listings | distance · recency · verified org boost |
| Mate listings | distance · breed-match · rating |
| Breeders | distance · verified · litters published |
| Shop products | distance to seller · rating · in-stock |
| Search "Near me" tab | unified distance-first across all entities |

### Mechanism (one place, reused everywhere)

- Migration: add `composite_score(distance_km, rating, review_count, freshness_days, boost)` SQL function (immutable, simple weighted formula).
- Migration: one RPC per discovery surface that already filters server-side, e.g. `discover_providers(_lat, _lng, _category, _radius_km, _open_now, _limit)` — uses `earthdistance` (already installed) for the distance calc, then sorts by `composite_score`.
- Same pattern applied to: `discover_adopt_listings`, `discover_mates`, `discover_breeders`, `discover_shop`, `discover_anything_near` (search).
- Frontend: a single `useNearbyQuery(rpc, params)` hook reads the user's coords from `useUserLocation`, calls the RPC, and gracefully falls back to city-only sort when location is denied.
- A small `<DistanceChip distanceKm={…} />` UI primitive renders "1.2 km" / "350 m" / "12 km" on every card so the user always sees how close things are. Used on every listing card across all hubs (one component, many screens).
- An "Auto · Distance · Rating · Newest" sort dropdown is added to `<ListingFilters>` so the user can override the default.

### Fallback chain (no location? still works)

```text
1. Browser geolocation (if granted)
2. Saved profile lat/lng
3. Selected city via existing GeoBanner
4. India-wide (last resort)
```

The composite score still works at every fallback level — distance contribution drops to 0 for level 4, so quality + freshness rank.

---

## Notifications & live updates (the "real" part)

These continue to use the Phase H push bridge (no new edge functions needed):

- New bid received → notification to customer (push + in-app).
- Bid accepted → push to chosen driver, push to losing drivers ("Trip taken by another driver").
- Driver within 200 m of pickup → push to customer ("Driver is here").
- Driver within 200 m of drop-off → push to customer ("Almost at drop-off").
- Mating request received → already wired; we add a "Distance: 4.2 km" line in the push body.
- Walker booked, vet booked, etc. — distance shown on confirmation card.

---

## Technical details (for the engineer / agent)

### Tables / functions added
- `taxi_bids` (RLS, realtime).
- Triggers: `tg_taxi_bid_notify_customer` (insert), `tg_taxi_bid_accepted` (update → rewires booking + closes losers).
- SQL: `composite_score(...)`, `discover_providers(...)`, `discover_adopt_listings(...)`, `discover_mates(...)`, `discover_breeders(...)`, `discover_shop(...)`.
- Geofence: extend `update_driver_location` RPC to call internal `transport_arrival_check`.

### Reused, NOT duplicated
- `transport_bookings` — bidding writes to existing row, doesn't fork.
- `service_providers` — driver entity = provider with `category = pet_taxi`.
- `notifications` table + Phase H push bridge — no new push wiring.
- `useUserLocation`, `useGeoCity`, `<GeoBanner>`, `<ListingFilters>` — extended, not replaced.
- `LeafletMap` — same component for taxi, kennel pickup, walker live view.

### Frontend new files
- `src/components/taxi/BidsList.tsx`
- `src/components/taxi/PlaceBidSheet.tsx`
- `src/pages/driver/TaxiInbox.tsx` + route
- `src/components/marketplace/DistanceChip.tsx`
- `src/hooks/useNearbyQuery.ts`

### Frontend touched
- `src/pages/TaxiDetail.tsx` — render `<BidsList>` while `requested`.
- `src/pages/Taxi.tsx` — link to driver inbox if provider has `pet_taxi`.
- `src/pages/discover/ServiceCategoryCity.tsx` — switch to `discover_providers` RPC + `<DistanceChip>` on cards.
- `src/pages/discover/AdoptCategory.tsx` — switch to `discover_adopt_listings`.
- `src/pages/Mates.tsx`, `Breeders.tsx`, `Shop.tsx`, `Search.tsx` — switch to their respective `discover_*` RPCs.
- `src/components/marketplace/ListingFilters.tsx` — add Sort dropdown (`auto / distance / rating / newest`).

### Acceptance (tested manually after ship)
1. Post a taxi from account A. Account B (provider with `pet_taxi`) sees it instantly in `/driver/taxi`, bids ₹280 / 6 min. Account A sees the bid card appear without refresh, accepts. Account B becomes the assigned driver. Live map starts. When B's GPS is within 200 m of pickup, A gets a push.
2. Open `/services/walker/pune` from a Pune location → results are now ordered nearest-first; each card shows "1.2 km · ★4.8". Toggle "Open now" → list re-orders.
3. Open `/adopt/dogs/pune` from Mumbai → still shows Pune dogs but distance shown is from Mumbai, ordered nearest-first within Pune.
4. Deny browser location, set city = Bangalore → results fall back gracefully, distance chips hidden, sorted by rating + recency.

---

## Reply with **"Go"** to ship Phase J.
