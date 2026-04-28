# Phase 3 — Privacy & Hardening

Aligns frontend and backend so that **truth, secrets, and authorization live in the backend**, while the frontend is purely a fast, friendly view layer. Closes the 7 gaps identified in the audit.

## Why this matters

Today, `pets` and `profiles` are world-readable to any signed-in user, the AI can be tricked with client-supplied pet data, the vet share-code is generated in the browser, and the shop ignores the allergies the user worked hard to enter during onboarding. None of these break the app — but each one is a leak between the two layers. This phase tightens the seams.

---

## 1. Backend — `pets` table privacy (RLS rewrite)

Replace the current `pets_select_all → using true` policy with two policies:

- **Owner can read everything about their own pets** (`auth.uid() = owner_id`).
- **Other signed-in users can read pets only when needed** — i.e. when the pet is `discoverable_for_mating = true` AND `vaccination_verified = true`, OR when the pet appears in a context the caller is already a party to (their own mating request, their own consult, their own booking, post they can already see).

Implementation: keep a single permissive `SELECT` policy with the OR'd conditions. No new tables. Existing INSERT/UPDATE/DELETE policies stay.

A sensitive-fields view (`public.pets_public`) exposes only `id, owner_id, name, species, breed, gender, avatar_url, bio, city, vaccination_verified, discoverable_for_mating` for marketplace surfaces; weight, allergies, conditions, neutered, temperament stay owner-only via the base table.

## 2. Backend — `profiles` table privacy (RLS rewrite)

Replace `profiles_select_all → using true` with:

- **Owner reads full row.**
- **Others read a public projection only** via a new view `public.profiles_public` exposing `id, full_name, avatar_url, city, bio` — no phone, no `emergency_vet`, no `notif_prefs`, no `goals`, no `language`, no `units`.

Frontend touchpoints (`PostFeed.tsx`, `CommentSheet.tsx`, `Admin.tsx`) switch to `profiles_public` for cross-user reads. Settings pages and `useProfile` keep reading `profiles` for the signed-in user.

## 3. Backend — harden `chat` edge function

Today the function trusts `body.petId` from the client and queries with the caller's JWT (RLS-scoped, so the user can't read another user's pet — that part is already safe). The remaining risk is *injecting fake context for the same user* via crafted message history. Fix:

- Continue using JWT-scoped Supabase client to fetch pet (already correct).
- **Strip any message with `role: "system"` from `body.messages`** so the client can't inject a fake system prompt.
- Add Zod-style validation: `petId` must be UUID, `messages` array max 30, each `content` ≤ 4000 chars, role restricted to `user|assistant`.
- Keep the system prompt and pet RAG context built **server-side only**.

## 4. Backend — vet access codes via edge function

Move `generateCode()` from `Health.tsx` into a new edge function `vet-grant-create` that:
- Validates the caller owns the pet (RLS via JWT).
- Generates a cryptographically random 8-char code server-side (`crypto.randomUUID().slice(0,8).toUpperCase()`).
- Inserts the grant with a 24h expiry and returns `{ code }` once.
Frontend `Health.tsx` calls `supabase.functions.invoke("vet-grant-create", { body: { petId } })` instead of inserting directly.

(The existing `vault-view` function already validates the code, so no change there.)

## 5. Frontend — Shop allergy filter

In `src/pages/Shop.tsx`:
- Pull the signed-in user's pets via `usePets()`.
- Compute `userAllergies = unique(pets.flatMap(p => p.allergies))`.
- Add a small toggle pill "Hide items unsafe for my pets" (default ON when allergies exist).
- When ON, filter products whose `title` or `description` contain any allergy term (case-insensitive). Show a soft helper: *"3 products hidden because of {pet}'s allergies."*

Pure client-side filter — safe because it's a *helpful* filter, not a security boundary.

## 6. Backend — gate notifications on `notif_prefs`

Update `public.notify_user(_user_id, _type, _title, _body, _link)`:
- Read `profiles.notif_prefs` for the recipient.
- Map types to channels: `post_like`, `post_comment` → `push`; `order_*`, `booking_*`, `mate_*`, `consult_*` → `push` always (transactional). Email/SMS fan-out stays disabled (no sender wired) but the function honors the prefs flag if/when added.
- If `notif_prefs.push = false`, skip the insert into `notifications`.

This makes the toggle truthful immediately for in-app notifications.

## 7. Backend — DB linter cleanup (lightweight)

- Move `pg_trgm` extension out of `public` into a new `extensions` schema.
- Tighten `posts` and `marketplace` storage buckets: keep public *read by URL* but restrict *list* — change the bucket policy so `SELECT` requires either `bucket_id = 'pet-avatars'` or `bucket_id = 'user-avatars'` (these stay listable as today), and remove broad list on `posts`/`marketplace`.

(`pet-avatars` and `user-avatars` remain listable since they're already low-sensitivity and used in cross-user UI.)

---

## File changes

**Backend (one migration + one edge fn + one edge fn edit):**
- NEW migration `phase3_privacy_hardening.sql` — RLS rewrites for `pets` & `profiles`, `profiles_public` & `pets_public` views, `notify_user` rewrite, `pg_trgm` move, storage policy tightening.
- NEW `supabase/functions/vet-grant-create/index.ts`.
- EDIT `supabase/functions/chat/index.ts` — Zod validation, strip client system messages.

**Frontend:**
- EDIT `src/pages/Shop.tsx` — allergy filter.
- EDIT `src/pages/Health.tsx` — call `vet-grant-create` instead of direct insert.
- EDIT `src/components/PostFeed.tsx` & `src/components/CommentSheet.tsx` & `src/pages/Admin.tsx` — use `profiles_public` for cross-user lookups.
- EDIT `src/pages/Discover.tsx`, `src/pages/MateListing.tsx` — verify they still read pets correctly under tightened RLS (likely no code change, just confirm queries match new policy).

## Order of operations

1. Migration (RLS + views + notify_user + pg_trgm + storage).
2. New `vet-grant-create` edge function.
3. Harden `chat` edge function.
4. Frontend swaps to `profiles_public` for cross-user reads.
5. `Health.tsx` → invoke new edge function.
6. `Shop.tsx` allergy filter.
7. Smoke test: discover page, mating listings, post feed, vet share link.

After Phase 3, every privacy-sensitive read is gated by the database, every secret stays in the edge function, and every user-visible promise (allergies, notification prefs) is actually honored.