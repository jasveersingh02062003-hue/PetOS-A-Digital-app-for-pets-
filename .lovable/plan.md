# Audit Result: What's broken & how to fix it

I audited the recent M4 + UX1 work against the live database and runtime logs. The frontend pages and components are wired up correctly, but **three real bugs are blocking the backend reminder pipeline and producing a UI warning**. Here's the targeted fix plan.

---

## Bugs found

### Backend (cron-driven reminders are silently failing)

From `appointment-reminders` edge function logs:

1. **`service_bookings` → `service_providers` join fails**
   `PGRST200: Could not find a relationship between 'service_bookings' and 'service_providers'`.
   The `service_providers` table exists, but `service_bookings.provider_id` has **no foreign-key constraint** pointing at it, so PostgREST refuses to embed it. Result: zero service-booking reminders ever go out.

2. **`transport_bookings` status filter uses non-existent enum value**
   `invalid input value for enum transport_status: "confirmed"`.
   The actual `transport_status` enum is: `requested, accepted, en_route_pickup, picked_up, en_route_drop, dropped_off, cancelled`. There is no `confirmed` or `pending`. Result: zero pet-taxi reminders ever go out.

### Frontend (console warning, harmless but real)

3. **`Splash` component triggers a React forwardRef warning** because `AnimatePresence` tries to attach a ref to it. Visible in console on every cold start.

Everything else I spot-checked is wired correctly: `ListingCard` is in use across Shop / Services / Vets, `useViewerMode` is consumed, the `appointment-reminders` cron is scheduled, deep-links route to `/bookings/:id`, RLS is in place.

---

## Fix plan

### Fix 1 — Add the missing FK (migration)

```sql
ALTER TABLE public.service_bookings
  ADD CONSTRAINT service_bookings_provider_id_fkey
  FOREIGN KEY (provider_id)
  REFERENCES public.service_providers(id)
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
```

This makes the `service_providers(name, category)` embed in the reminder function resolve, and also unlocks the same join everywhere else in the app.

### Fix 2 — Use the correct transport enum values

In `supabase/functions/appointment-reminders/index.ts`, change the transport query from:

```ts
.in("status", ["confirmed", "accepted", "pending"])
```

to:

```ts
.in("status", ["requested", "accepted", "en_route_pickup"])
```

That covers every state where a 30-minute pre-pickup reminder still makes sense.

### Fix 3 — Wrap Splash so AnimatePresence can attach its ref

Convert `src/components/Splash.tsx` to a `React.forwardRef` component (or just attach the ref to the outer wrapper). Smallest change: forward the ref to a fragment-replacing wrapper `<div ref={ref}>` around the existing tree. Removes the dev warning, no behavior change.

### Verification

After applying:
- Re-invoke `appointment-reminders` manually and confirm logs show `queued: N` with **no** PGRST200 / 22P02 errors.
- Insert a test `service_booking` ~30 min in the future and confirm a `notifications` row appears for the customer with `link='/bookings/:id'`.
- Reload the preview, confirm the React forwardRef warning is gone.

---

## Out of scope (already working, no change needed)

- M1–M4 booking flows, live tracking page, push trigger.
- UX1 marketplace primitives and rollout to Shop/Services/Vets/Adopt/Mates.
- RLS policies, auth, install banner, viewer mode hook.

Reply **approve** and I'll ship the migration, the edge-function patch, and the Splash fix in one pass.
