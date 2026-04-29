# PetOS — Correctly Sequenced Production Readiness Plan

You're right. The previous plan was technically sound but wrongly ordered. Optimizing queries on an app that still has security gaps and broken user-facing flows is premature. Here is the corrected sequence.

## Guiding principle

```text
Safe  →  Correct  →  Fast  →  Scalable
```

Don't optimize what isn't proven correct. Don't make fast what isn't safe.

---

## Phase 0 — Security & data integrity (BLOCKING, do first)

Nothing else ships until this is green.

1. **Re-run the security scanner** and fix every `error` and `warn` finding.
2. **Audit RLS on every table** that holds user data — confirm `auth.uid()`-scoped policies on read AND write.
3. **Lock down public RPCs** (`get_pet_public_by_ref`, `get_profile_public_by_ref`) — confirm they only return non-sensitive columns.
4. **Verify `user_roles` is admin-only writable** — privilege escalation check.
5. **Enable leaked-password (HIBP) protection** on auth.
6. **Confirm storage bucket policies** — medical records, vet docs, private photos must not be world-readable.

Deliverable: clean security scan, documented RLS matrix.

---

## Phase 1 — Fix critical user-facing bugs

Before optimizing, the core flows must actually work end-to-end with real data.

1. **Public pet profile route** (`/pet/:id`) — confirmed broken earlier; verify the public RPC fallback works for logged-out users.
2. **Auth flows** — signup, login, Google OAuth, password reset, email verification.
3. **Core CRUD** — create pet, edit pet, upload photo, delete pet.
4. **Payment/checkout** — at least one successful Stripe test transaction end-to-end.
5. **Vet booking, adoption inquiry, messaging** — one successful run through each.

Deliverable: a manual smoke-test checklist passed on the live preview.

---

## Phase 2 — Realistic seed data

You can't measure performance on 13 demo rows. Before any optimization work:

1. Seed **~500 pets, ~200 users, ~2000 posts, ~5000 likes, ~1000 comments, ~100 conversations with messages**.
2. Use the existing `seed-demo-data` edge function, expanded.
3. This is what makes Phase 3 measurements meaningful.

Deliverable: realistic dataset loaded in the dev backend.

---

## Phase 3 — Quick performance wins (low risk, high impact)

Only now do we touch performance. These are all low-effort, low-risk:

1. **Add missing indexes** on hot foreign keys: `conversation_members.user_id`, `daily_streaks.user_id`, `posts.author_id`, `likes.post_id`, `comments.post_id`, `follows.follower_id/followed_id`, `notifications.user_id`.
2. **Tune React Query** — bump `staleTime` to 60s for feeds, 5min for profile/static data; keep `gcTime` at 5min.
3. **Add `loading="lazy"` and `decoding="async"`** to every `<img>` not above the fold.
4. **Replace top 10 hottest `select('*')` calls** with explicit column lists (feed, profile, pet card, message list).
5. **Add optimistic updates** for like, follow, comment — perceived latency drops to zero.

Deliverable: measurable improvement in feed load and interaction latency, no architectural changes.

---

## Phase 4 — Structural performance (only if Phase 3 isn't enough)

Defer until Phase 3 is shipped and measured. These have higher complexity:

1. **Thin read views / materialized counters** for like/follow/comment counts.
2. **List virtualization** with `@tanstack/react-virtual` for feed and messages.
3. **Image resizing pipeline** (edge function) — thumbnail / feed / full variants.
4. **Service Worker upgrade** — runtime caching for images and API GETs.
5. **`persistQueryClient`** — instant feed render from sessionStorage on revisit.
6. **Eliminate remaining `select('*')`** across the codebase.

Deliverable: Instagram-grade perceived performance.

---

## Phase 5 — Storage strategy (clarification, mostly already correct)

Document and enforce where data lives:

| Layer | Use for | Examples |
|---|---|---|
| **localStorage** | Tiny, non-sensitive, sync | Theme, last route, dismissed banners |
| **sessionStorage** | Per-tab cache | React Query persisted snapshot |
| **IndexedDB** (`idb-keyval`) | Larger client cache, drafts | Post drafts, recently viewed pets, offline queue |
| **Memory (React Query)** | Server state cache | All API responses |
| **Cloud DB (RLS)** | Source of truth | Pets, users, posts, medical records |
| **Cloud Storage (RLS)** | Files | Photos, vet docs, voice notes |

Rule: **never** put auth tokens, medical data, or private content in localStorage/IndexedDB.

---

## Phase 6 — Production launch config

1. Stripe live keys (currently test mode).
2. Custom domain.
3. Custom email sender domain.
4. (Optional) VAPID keys for web push.
5. Enable analytics + error tracking.
6. Final security scan + smoke test on production URL.

---

## What I need from you

Confirm this order is right, then I'll start at **Phase 0** (security scan + fixes). I will not jump ahead to performance work until 0–2 are signed off.

Reply "go" and I begin with Phase 0.
