## Goal

Make Petos safe for an invite-only beta (≤500 users) without needing Stripe, Google, Razorpay, Sentry, or any external account from you. Plus stays "Notify me" only — no real payments yet.

## What's in scope (no external accounts needed)

These are the Top 10 audit fixes, trimmed to what we can do entirely inside Lovable Cloud:

### Slice 1 — Legal pages + medical/AI disclaimers
- New routes: `/legal/terms`, `/legal/privacy`, `/legal/refunds` (India DPDP-aware copy, plain English).
- Footer links from `Profile`, `Auth`, and `Plus` pages.
- New shared `<MedicalDisclaimer />` component shown on `AiChat`, `VetConsult`, `SymptomLogger`, `HealthRecords` — calm tone: "Petos AI gives general guidance, not a diagnosis. For emergencies, contact your vet."
- Signup gate: checkbox "I agree to Terms & Privacy" on `Auth.tsx` before account creation.

### Slice 2 — AI quota: atomic + correct limits
- Migration: replace racy upsert with a single SQL function `increment_usage(_user, _kind, _limit, _window_days)` returning `{allowed, remaining, resets_at}`. Uses `INSERT … ON CONFLICT DO UPDATE` in one statement — no race.
- Update `supabase/functions/chat/index.ts` to call this RPC and return `429` with `resets_at` when over limit.
- Fix limit to **3 chats / 30 days** for free tier (matches spec). Plus = unlimited.
- UI: `AiChat.tsx` shows "2 of 3 free chats left this month" + soft paywall when 0.

### Slice 3 — RLS & function lockdown
- Tighten `pets` SELECT: split the giant OR policy into named, intent-specific policies; stop leaking `owner_id` to anyone who can see a post.
- Create a `public.pets_public` view exposing only safe columns (`id, name, species, breed, avatar_url, city, discoverable_for_mating`) for feed/discovery joins.
- Revoke `EXECUTE … FROM PUBLIC` on `SECURITY DEFINER` functions; grant only to `authenticated` where needed.
- Add `notifications` INSERT policy (currently no one can insert — server functions need explicit grant via SECURITY DEFINER helper).

### Slice 4 — Storage hardening
- Migration on `storage.objects` policies: disable anonymous `LIST` on `posts`, `missing-pets`, `pet-avatars` buckets. Keep public `SELECT` on individual object paths only (so direct image URLs still work, but bucket enumeration is blocked).
- Add per-user upload size + MIME-type check via storage policy (`octet_length < 5MB`, `mime_type LIKE 'image/%'`).

### Slice 5 — Async missing-pet fan-out
- Drop the synchronous trigger on `missing_pets`.
- Replace with: trigger inserts a single row into a new `notification_jobs` table → edge function `process-notification-jobs` (invoked via `pg_net` from the trigger, or polled) fans out in batches of 200.
- Prevents transaction timeouts when city has thousands of users.

### Slice 6 — Auth flow polish (no Google, email only)
- `Auth.tsx`: handle `email_not_confirmed` error explicitly with "Check your inbox to verify" state + "Resend verification" button.
- Password reset: `/auth/forgot` + `/auth/reset` pages using `supabase.auth.resetPasswordForEmail`.
- Block onboarding redirect until `user.email_confirmed_at` is set.

### Slice 7 — Rate limits on user content
- DB triggers: max 10 `posts`/day, 60 `post_comments`/day, 20 `missing_pet_sightings`/day per user. Returns friendly error code the UI can translate to "You've hit today's limit — try again tomorrow."

### Slice 8 — Account deletion (DPDP requirement)
- New `/profile/delete` page with confirmation typing user's email.
- Edge function `delete-account` (service role) that: cascades user data, calls `auth.admin.deleteUser`, logs a tombstone in a new `deletion_log` table.
- Add missing `ON DELETE CASCADE` foreign keys: `posts.author_id`, `post_comments.author_id`, `pets.owner_id`, `notifications.user_id`, etc. (currently missing — orphan rows on user delete).

### Slice 9 — Pagination + query limits
- Replace `.select()` with cursor pagination (`created_at < lastSeen`) on: `Feed`, `MissingPets`, `Marketplace`, `AiChat` history, `Notifications`. Page size 20.
- Fixes the silent 1000-row Supabase cap.

### Slice 10 — Lightweight observability (no Sentry account)
- New `error_log` table (RLS: insert by anyone authenticated, select by admins only).
- Global error boundary + edge function `try/catch` writes to `error_log` with user_id, route, error, stack.
- Admin page `/admin/errors` lists last 200, filterable.
- Zero external account; you read errors inside the app.

## What we're explicitly NOT doing in this round (need your accounts)

- Stripe/Razorpay live payments → Plus stays "Notify me when launching" (already built).
- Google OAuth → email/password only.
- Sentry / external monitoring → using the in-app `error_log` instead.
- SMS via Twilio → push + email only (already in `notif_prefs`).

When you're ready with any of those accounts later, we add them as separate slices without re-doing this work.

## Order of execution

I'll do these as **3 batched merges** (not 10 one-at-a-time, since you approved the audit) to keep momentum:

- **Merge A (security/data integrity):** Slices 3, 4, 5, 7, 8, 9 — all DB migrations + edge function changes.
- **Merge B (auth + legal):** Slices 1, 2, 6 — user-facing flows.
- **Merge C (observability):** Slice 10.

Each merge ends with a short verification list so you can test before moving to the next.

## Technical notes

- All SQL goes through migrations; data fixes (e.g. backfilling `notification_jobs`) go through the insert tool.
- No edits to `src/integrations/supabase/{client,types}.ts`, `.env`, or `supabase/config.toml` project block.
- Brand tone preserved: calm, never alarming, mobile-first 393px.
- Medical disclaimer wording will be reviewed once and reused via shared component (single source of truth).

## Definition of done for this round

- All P0 audit items either fixed or explicitly deferred to a "needs your account" list.
- Soft-launch ready for ≤500 invited beta users.
- A short README section in `.lovable/plan.md` listing what still needs Stripe/Google/etc. before public launch.

Approve and I'll start with **Merge A**.
