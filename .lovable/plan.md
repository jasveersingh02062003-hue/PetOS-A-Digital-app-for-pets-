# Phase 2 — Closing the Loop

Phase 1 shipped every core surface (pets, vault, social, AI, mating, services, shop). Phase 2 adds the trust, retention, and polish layers that turn the marketplaces into something people actually transact on.

We'll ship in 5 focused stages. Each stage is independently shippable so you can pause at any point.

---

## Stage A — Vet Portal & Vaccination Verification

The `vet` role exists in the DB but has no UI. This stage gives vets a real workspace and turns the manual "vaccination_verified" boolean into a workflow.

**What gets built**
- `/vet` dashboard — queue of `awaiting_vet` consults sorted by severity, with claim/assign action.
- `/vet/consult/:id` upgraded with vet-only controls: status transitions, prescription field, completion notes, mark complete.
- Vaccination verification queue: vet (or admin) reviews uploaded vaccine docs and flips `vaccination_verified` on the pet.
- Owner-side: "Request verification" button on each pet → creates a `verification_requests` row.
- Vet onboarding: `/vet/apply` form (clinic name, license #, city) creating a `vet_applications` row that admins approve to grant the `vet` role.

**DB changes**
- New `verification_requests` (pet_id, status, reviewer_id, notes)
- New `vet_applications` (user_id, clinic, license_number, status)

---

## Stage B — Reviews, Ratings & Trust

Reviews unlock the marketplace. Without them, providers, sellers, and mating partners are anonymous strangers.

**What gets built**
- Generic `reviews` table keyed by `subject_type` (`provider` | `product` | `pet_partner` | `vet`) + `subject_id`, with rating 1–5, body, and `verified_purchase` flag (auto-set when a matching `service_bookings`/`shop_orders`/`mating_agreements` row exists).
- Star ratings on every provider card, product card, and pet listing (aggregate via a SQL view).
- Review composer sheet that opens after a booking is `completed` or an order is `delivered`.
- "Reviews" tab on Service Detail and Shop product pages.
- One review per (user, subject) — enforced by unique index.

---

## Stage C — Notifications & Realtime

Right now nothing tells you "your booking was confirmed." This stage adds an in-app inbox and live toasts.

**What gets built**
- `notifications` table (user_id, type, title, body, link, read_at).
- DB triggers fan out events to recipients:
  - booking created → provider owner; status changed → customer
  - order placed → each seller; status changed → customer
  - mating request received / agreement signed
  - consult assigned / updated
  - comment on your post / like on your post
- Bell icon in the AppShell header with unread count, opening `/notifications`.
- Realtime subscription in a `useNotifications` hook — Sonner toast pops live.
- (Stub) Twilio + Web Push hooks left as documented TODO points where the trigger can later call an edge function.

---

## Stage D — Image Uploads, Search & Discovery

Currently products and provider covers are URL-only; nothing is searchable beyond category filters.

**What gets built**
- Reusable `<ImageUpload />` component using existing `posts` bucket pattern; new `marketplace` storage bucket (public read).
- Wire upload into `ServiceNew`, `ShopNew`, `MatesNew`, and provider/product edit screens.
- Universal search at the top of Discover: searches pets, providers, products by name/breed/title (Postgres `ilike` + `pg_trgm` index for speed).
- Empty states with illustrations across all marketplace screens.

---

## Stage E — Admin Console, Google Sign-in & PWA

Operational and login polish.

**What gets built**
- Google sign-in on `/auth` via `lovable.auth.signInWithOAuth("google", …)` — the social-login configurator runs first.
- `/admin` dashboard (super_admin / moderator only): user list with role assignment, vet-application review, content moderation queue (reported posts/comments), platform metrics.
- Report action on posts, comments, listings → `reports` table → admin queue.
- PWA manifest + service worker (`vite-plugin-pwa`) with `/~oauth` denylist so the app installs to home screen.
- HIBP leaked-password protection enabled via `configure_auth`.

---

## Technical details

- **Schema additions:** `verification_requests`, `vet_applications`, `reviews`, `notifications`, `reports` — all RLS-protected. Aggregate ratings exposed via a `subject_ratings` view (avg + count).
- **Trigger pattern:** notification fan-out uses `SECURITY DEFINER` triggers writing into `notifications`; recipient list computed inline (no queue table).
- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` and a single channel filtered by `user_id`.
- **Storage:** new public `marketplace` bucket; folder convention `{user_id}/{uuid}.{ext}` so RLS by path prefix works.
- **Search:** add `pg_trgm` extension and GIN indexes on `pets.name`, `pets.breed`, `service_providers.name`, `shop_products.title`. Single edge function `search` returns merged results.
- **Auth:** `lovable.auth.signInWithOAuth` is the only client call; do **not** touch `src/integrations/lovable/`.
- **PWA:** `VitePWA({ workbox: { navigateFallbackDenylist: [/^\/~oauth/] }})` — required for OAuth to keep working on installed PWA.

## Explicitly out of scope (still Phase 3)
- Real Twilio SMS / Stripe payments wiring — code paths remain stubbed; we'll do these when you're ready to connect accounts.
- Video tele-vet calls.
- AI image input (X-rays, stool photos).
- Multilingual support.

## Files (high level)

```text
NEW   supabase/migrations/<ts>_phase2_vet.sql
NEW   supabase/migrations/<ts>_phase2_reviews.sql
NEW   supabase/migrations/<ts>_phase2_notifications.sql
NEW   supabase/migrations/<ts>_phase2_reports.sql
NEW   supabase/migrations/<ts>_phase2_search.sql

NEW   src/pages/Vet.tsx, VetApply.tsx, Notifications.tsx, Admin.tsx
NEW   src/components/ImageUpload.tsx, ReviewSheet.tsx, ReviewList.tsx,
      RatingStars.tsx, NotificationBell.tsx, ReportButton.tsx,
      SearchBar.tsx
NEW   src/hooks/useNotifications.tsx
EDIT  ServiceDetail, MateListing, Shop, Discover, AppShell,
      ServiceNew, ShopNew, MatesNew, Auth, App.tsx, vite.config.ts
```

No new paid dependencies. Will add `vite-plugin-pwa` and run `configure_social_auth` for Google.

## What I need from you
Just approval. If you want to drop or reorder a stage, say so and I'll revise.
