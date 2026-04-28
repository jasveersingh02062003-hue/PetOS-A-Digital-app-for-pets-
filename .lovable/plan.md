# Phase 4 — Missing Pet alerts + Petos Plus subscription

Two features. Both expand the trust spine without changing the design language. Built on the same backend disciplines as Phase 3: privacy in the database, money handling on the server, the UI just renders.

---

## A. Missing Pet — community safety net

### What the user does

Riya's neighbor's Indie runs out during Diwali. She opens Coco's profile → taps the new red **"Coco is missing"** button. A sheet asks for: a fresh photo (defaults to the latest pet avatar), last-seen location (uses browser geolocation, falls back to manual lat/lng or city), reward amount, and an optional note ("scared of fireworks, do not chase").

She submits → a `missing_pets` row is created with status `active`. Within seconds, every Petos user whose `profiles.city` matches OR whose own pets share the same city receives an in-app notification: *"Help find Coco — Indie, last seen 0.8 km from Indiranagar."*

A new **Alerts** tab on Home shows active missing pets nearby, sorted by distance and recency. Tapping one opens `/missing/[id]` — a focused page with the photo, last-seen pin (placeholder map for v1), reward, owner's first-name + chat button, and a **"I've seen this pet"** action.

When another user taps "Sighted", they upload a photo + drop a pin → creates a `missing_pet_sightings` row. The owner gets a realtime push (`Sighting near MG Road, 12 min ago`). All sightings are timestamped on the missing-pet page.

When the pet is found, the owner taps **"Found Coco"** → status flips to `resolved`, alerts stop, the page archives with a thank-you note to everyone who reported.

### Backend

- New table `missing_pets` (`pet_id`, `owner_id`, `photo_url`, `last_seen_lat`, `last_seen_lng`, `last_seen_city`, `last_seen_at`, `reward_inr`, `note`, `status` enum `active|resolved|cancelled`).
- New table `missing_pet_sightings` (`missing_pet_id`, `reporter_id`, `photo_url`, `lat`, `lng`, `note`, `created_at`).
- RLS:
  - `missing_pets`: anyone signed in can SELECT active rows; owner can INSERT/UPDATE; only the pet's owner can resolve.
  - `missing_pet_sightings`: anyone signed in can INSERT; owner of the missing_pet + the reporter can SELECT; no UPDATE/DELETE.
- New trigger `notify_missing_pet_alerts` on INSERT to `missing_pets`: calls `notify_user` for every user whose `profiles.city = NEW.last_seen_city` (excluding the owner), title *"Help find {pet name}"*, link `/missing/{id}`.
- New trigger `notify_owner_on_sighting` on INSERT to `missing_pet_sightings`: notifies the missing pet's owner.
- New storage bucket `missing-pets` (public read, owner-write) for photos.

### Frontend

- New page `src/pages/MissingNew.tsx` — create flow.
- New page `src/pages/MissingDetail.tsx` — single missing pet view + sightings feed (realtime).
- New page `src/pages/MissingFeed.tsx` — list of nearby active missing pets.
- New tab/link in Home for "Alerts" that surfaces a horizontal strip of active local cases.
- "Coco is missing" CTA on `Profile.tsx` (under each pet card).

### Monetization (stubbed for now, Stripe-ready)

- Listing fee ₹499 — surfaced in the create flow with a clear *"Beta — free for early users"* badge. Once Stripe is live, swap the badge for a checkout call.

---

## B. Petos Plus — subscription tier

### What the user gets

**Free (default):**
- 5 AI chats / day
- 1 active missing-pet listing at a time
- Basic vault sharing (24h codes)
- Community feed, mating, services, shop — all free

**Petos Plus — ₹299/month or ₹2,499/year (≈ 2 months free):**
- Unlimited AI chats + triage history saved
- 2 free vet consults per month (₹199 value each)
- Unlimited active missing-pet listings + boosted notifications (push to wider radius)
- Custom vault share durations (up to 7 days)
- Plus badge on profile and posts
- Priority placement in mating discovery

### Backend

- New table `subscriptions` (`user_id` unique, `tier` enum `free|plus`, `status` enum `active|past_due|canceled`, `provider` text, `provider_subscription_id` text, `current_period_end` timestamptz, `cancel_at_period_end` bool).
- New table `usage_counters` (`user_id`, `kind` text e.g. `ai_chat`, `vet_consult`, `period` date, `count` int, PRIMARY KEY(user_id, kind, period)) — server-side rate limiting source of truth.
- New SECURITY DEFINER function `public.current_tier(_user_id uuid)` returning `'free'|'plus'`. Defaults to `'free'` if no row.
- RLS: each user can SELECT their own subscription + usage. Only the edge function (service role) writes.
- Hard gates moved server-side:
  - **chat edge function**: at the top, increment `usage_counters` for `ai_chat` (today's date). If `current_tier = free` and count > 5, return `402 { error: "Daily AI limit reached. Upgrade to Plus." }` *before* spending tokens.
  - **vet-consult create**: if free, count completed consults this calendar month; if free + already 0 free consults → require pay-per-consult flow.
  - **missing-pets insert trigger** (DB-side): block additional active rows if free tier already has one active.

### Stripe wiring

- Enable Stripe via the built-in payments tool (chosen because Petos is digital-only, India + global users, recurring billing). Use **`automatic_tax: enabled`** at checkout for tax calculation only — Petos handles GST filing in India.
- Two products: `Petos Plus (Monthly) ₹299`, `Petos Plus (Yearly) ₹2,499`. One-time consult product `Vet Consult ₹199`.
- New edge function `create-checkout` — accepts `{ kind: "plus_monthly" | "plus_yearly" | "vet_consult", consultId? }`, looks up logged-in user, creates a Stripe Checkout Session with metadata `user_id`, returns the URL.
- New edge function `stripe-webhook` (`verify_jwt = false`, signature-verified):
  - `checkout.session.completed` for subscriptions → upsert `subscriptions` row, tier `plus`, `status=active`, store `current_period_end`.
  - `customer.subscription.updated/deleted` → keep `status` and `cancel_at_period_end` in sync.
  - `checkout.session.completed` for one-time consult → mark the matching `vet_consults` row as paid.
- New page `src/pages/Plus.tsx` — pricing comparison (Free vs Plus), monthly/yearly toggle, big "Upgrade" button → calls `create-checkout` → redirects to Stripe Checkout.
- New page `src/pages/PlusSuccess.tsx` — celebratory landing after Stripe redirect, polls `subscriptions` until tier flips to `plus`.
- Settings → new "Billing" panel — shows current tier, renewal date, cancel link.

### UX gating in the app

- A small reusable `<TierGate />` component that:
  - Reads `current_tier` once (cached in TanStack Query for 60s).
  - On gated actions, shows a soft sheet: *"You've hit your free limit. Plus gives you unlimited."* with one-tap upgrade.
- Plus badge component appears next to user names in feed/comments when their `subscriptions.tier = 'plus'` (read via the public profile RPC, extended to include `tier`).

---

## File changes

**Backend (3 migrations + 4 edge functions):**
1. Migration: `missing_pets`, `missing_pet_sightings`, RLS, two notify triggers, storage bucket.
2. Migration: `subscriptions`, `usage_counters`, `current_tier()` function, RLS, gates.
3. Migration: extend `get_profiles_public` to include `tier` (compute via `current_tier`).
4. Edge fn `create-checkout` (Stripe).
5. Edge fn `stripe-webhook` (Stripe, signature-verified, no JWT).
6. Edge fn `chat` — add usage counter + tier gate at top.
7. Edge fn `consult-create` (new) — wraps consult creation with tier gate / payment requirement.

**Frontend (~9 new files + small edits):**
- `src/pages/MissingNew.tsx`, `MissingDetail.tsx`, `MissingFeed.tsx`
- `src/components/MissingCreateSheet.tsx`, `MissingStrip.tsx` (Home strip)
- `src/pages/Plus.tsx`, `PlusSuccess.tsx`
- `src/components/TierGate.tsx`, `PlusBadge.tsx`
- `src/pages/settings/Billing.tsx`
- Edits: `src/pages/Profile.tsx` (Missing CTA), `src/pages/Home.tsx` (Alerts strip), `src/App.tsx` (routes), `src/components/PostFeed.tsx` (Plus badge), `src/pages/AiChat.tsx` (TierGate on send)

## Order of operations

1. **Missing Pet migration** + storage bucket + triggers.
2. **Missing Pet UI** (create, detail, feed) + Home strip + Profile CTA.
3. **Subscription migration** + `current_tier()` + usage counters.
4. **Enable Stripe** (built-in, automatic_tax = on).
5. **Create products** (Plus monthly, Plus yearly, Vet consult).
6. **`create-checkout` + `stripe-webhook` edge functions**.
7. **Plus page, Success page, Billing settings**.
8. **TierGate + PlusBadge** wired across AI chat, missing-pets, comments, feed.
9. **Server-side gates**: chat function rate-limits free tier; missing-pets DB trigger limits free tier to 1 active.

## What stays free forever (anchor of the brand)
Onboarding, social feed, mating discovery (no fee to *find* a mate, only to *list* a stud), basic AI (5/day), 24h vet vault sharing, all reviews, all notifications, all health vault writes. Plus is purely additive — never a paywall in front of safety.

---

After Phase 4, Petos has a complete monetization spine *and* the community-safety feature that turns it from "an app I open" into "an app my whole neighborhood depends on". Trust + revenue, both compounding.