# Plan — Closing the real-life gaps

The audit identified 6 critical gaps blocking real money/trust flows, 10 important polish gaps, and 7 nice-to-haves. The database already supports most of this work — the gaps are almost entirely **frontend wiring**.

We'll ship in two sprints. **REAL-1 unblocks revenue + trust** (cannot ship the app without it). **REAL-2 adds the polish** that makes the app feel complete.

---

## Sprint REAL-1 — Close the loop (ships first)

Goal: every paid flow completes, every listing earns trust, and every order is trackable end-to-end.

### 1. Dynamic checkout route (unblocks ALL payments)

The Cart and BookAppointment pages navigate to `/checkout/dynamic?kind=…&ref=…&amount=…&name=…&next=…` but no such route exists — every shop order and paid vet booking 404s today. The `payments-create-checkout` edge function already accepts `{ kind, refId, amountInr, productName }` for dynamic pricing.

- Create `src/pages/CheckoutDynamic.tsx`. Reads query params, calls `payments-create-checkout` with `amountInr` + `productName`, mounts Stripe Embedded Checkout (`return_url` → `/checkout/return?next=…&ref=…&kind=…`).
- Register route `<Route path="/checkout/dynamic" element={<CheckoutDynamic />} />` in `App.tsx`.
- Update `CheckoutReturn.tsx` to honour the `next` query param and show kind-specific success copy ("Order placed", "Vet booked", etc.).

### 2. Wishlist (saves persist + dedicated page)

`WishlistButton` exists but is only mounted on Adopt cards, and the `wishlists` table has zero rows in production.

- Mount `<WishlistButton>` on `ListingCard` usages for Shop, Services, and Vets.
- Build `src/pages/Wishlist.tsx` — grid of saved items grouped by kind (shop / service / vet / adopt), with remove + open actions.
- Add `/wishlist` route and a heart-icon entry in the bottom nav (or profile menu).

### 3. Shop product detail page (Amazon-pattern)

There is no `/shop/:id` route today — buyers can't see a product's full description, reviews, or related items.

- Build `src/pages/ProductDetail.tsx`: hero image carousel, title, `<PriceTag>`, stock badge, description, seller chip, "Add to cart" / "Buy now", `<ReviewsList>` block, and a "More from this seller" rail.
- Register `<Route path="/shop/:id" element={<ProductDetail />} />`.
- Update `Shop.tsx` `ListingCard` `to` prop to point at `/shop/:id`.

### 4. Reviews where they're missing + auto-prompt

`ReviewsList` is only on `ServiceDetail`, `OrgProfile`, `UserProfile`. Vet detail and shop product pages have nothing.

- Mount `<ReviewsList subjectId={…} subjectType="vet|product">` on the new `ProductDetail` page and on the existing vet detail surface.
- In `Orders.tsx` and `MyAppointments.tsx`, when an item's status is `delivered` / `completed` and the user has not yet reviewed, render a "Rate your experience" CTA that opens `<LeaveReviewSheet>`.

### 5. Availability picker (booking respects real schedules)

`provider_hours` (weekday/open/close) and `vet_availability` (weekday/start/end/mode) tables exist with RLS; nothing in the UI reads them.

- Build `src/components/booking/AvailabilityPicker.tsx`. Props: `providerId | vetId`, `mode`, `onSelect(datetimeISO)`. Reads weekly windows + existing `appointments`/`service_bookings` for the chosen date, renders a 30-min slot grid, disables unavailable / already-booked slots.
- Integrate into `BookAppointment.tsx` (replaces freeform datetime input) and `ServiceDetail.tsx`'s "Book" sheet.

### 6. Order shipment timeline

`shop_orders` has `tracking_number`, `courier`, `shipped_at`, `delivered_at`, `eta_at`, status enum, and is on `supabase_realtime`. The timeline just isn't drawn.

- Build `src/components/orders/ShipmentTimeline.tsx`. 5 stages: Placed → Confirmed → Shipped → Out for delivery → Delivered. Filled circles + timestamps from the order row; current stage pulses; tracking number + courier shown when set.
- Wire it into `Orders.tsx` (per order) and into `Notifications` deep-links.
- Subscribe to `postgres_changes` on `shop_orders` filtered by `id` so the timeline updates live.

### Acceptance for REAL-1
- Pay flow: Cart → `/checkout/dynamic` → Stripe → `/checkout/return` → `/orders` (no 404 anywhere).
- Saving any listing creates a `wishlists` row; `/wishlist` lists it; remove works.
- `/shop/:id` renders product, reviews, related; "Add to cart" works; reviewing a delivered order is one-tap.
- Booking a vet/service only allows slots inside the provider's hours and outside existing bookings.
- Order shipment timeline updates live when the seller marks the order shipped/delivered.

---

## Sprint REAL-2 — Polish & trust (ships after REAL-1)

### 7. Mating: payment + agreement PDF surface
- Add "Pay deposit" button on `MateListing` that creates a `mating_payments` row and routes to `/checkout/dynamic`.
- Add "Download agreement PDF" button that calls the existing `mating-agreement-pdf` edge function and triggers a browser download.

### 8. Insurance leads
- Build `src/pages/Insurance.tsx`: lists `insurance_partners`, lead-capture form writes to `insurance_leads`, success state with "We'll connect you within 24 hours."
- Add an entry from Health page and Pet profile sidebar.

### 9. Refund / dispute flow
- Add "Request refund" button on Order, Booking, and Taxi detail pages (gated by status). Opens a sheet that posts to a new `refund_requests` table (migration: id, source_kind, source_id, user_id, reason, status enum, created_at).
- Admin queue under `/admin/refunds` that lists pending refund requests; approving calls `payments-refund` edge function.

### 10. Family / care-team management
- Build `src/pages/FamilyShare.tsx` (`/settings/family`): list `pet_care_team` rows for my pets, "Invite by email" form writes a `pet_access_request`, accept/decline from the existing `AccessRequests` page.

### 11. Saved searches
- On `Search.tsx`, "Save this search" button persists current filters into `saved_searches`. Profile menu shows "Saved searches" → re-runs them.

### 12. Geofences on GPS tracker
- In `PetTracker.tsx`, add a "Safe zones" section: draw circles on the Leaflet map, allow create/edit/delete; cron `pet-care-reminders` already exists — extend it to insert a `notifications` row when latest ping leaves a fence.

### 13. Family-shared GPS
- "Share live location" button on `PetTracker` page generates a public token (existing `public_share_token` pattern from bookings). New `/track/:token` page renders read-only live map.

### 14. Local groups by city
- `Groups.tsx` adds a "Near you" section filtered by `profiles.city` with an empty-state CTA to create one.

### 15. Playdate planner CTA
- On `PetProfile.tsx` add a "Plan a playdate" button that pre-fills `MeetupNew` with the pet's species/city.

### Acceptance for REAL-2
- Mating deposits payable, agreements downloadable.
- Insurance leads captured + visible to admin.
- Refunds requestable and approvable end-to-end.
- Family invites + access requests work both ways.
- Saved search round-trips.
- Safe-zone breach triggers a notification.
- "Share live location" link opens for any browser without auth.

---

## Out of scope (Sprint UX2 / future)

- i18n, IndexedDB offline cache for cart/recent pets.
- Recently-viewed rail and detail-page redesigns (already queued in UX2).
- Biometric / PIN lock on Vault.
- Multi-pet bulk operations and richer PDF exports.

---

Reply **"go REAL-1"** to start the first sprint. REAL-2 will be queued behind it.
