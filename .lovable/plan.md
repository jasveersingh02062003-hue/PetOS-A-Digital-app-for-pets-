# PetOS — Production Readiness Plan (Phases 5 → 10)

## Where we are

Phases 0–4 are done: PII tightened, critical paths verified, realistic seed loaded (500 pets / 2k posts / 4.5k likes), 5 hot indexes added, query staleTime tuned, 63 lazy `<img>`, infinite-scroll feed.

The app is now **fast enough and safe enough for a beta**. To call it production-grade, six gaps remain. They are listed in the order they should ship.

```text
Safe → Correct → Fast → Observable → Resilient → Compliant
                          ▲ you are here
```

## Snapshot of remaining gaps

| Area | Current state | Risk |
|---|---|---|
| Security findings | 279 open (132 anon-callable `SECURITY DEFINER` fns, 7 public storage buckets, 4 extensions in `public`, leaked-password check off) | Medium-High |
| Observability | 4 `console.log` calls, 0 Sentry/PostHog, no edge-fn log dashboard | High — you are blind in prod |
| Tests | 0 test files in `src/` | High — every ship is a roll of the dice |
| Storage strategy | No documented split between localStorage / IndexedDB / Cloud / SW cache | Medium |
| Resilience | No offline queue, no request retry with backoff, no health check on edge fns | Medium |
| Compliance / legal | No GDPR export-my-data UI, no cookie banner, no documented data-retention | Low-Medium (depends on launch market) |

---

## Phase 5 — Close the security backlog (1 session)

The 279 findings collapse into ~5 real issues.

1. **132 anon-callable `SECURITY DEFINER` functions.** Audit each one: keep `EXECUTE` for `anon` only on the handful that genuinely power public pages (`get_pet_public_by_ref`, `get_profile_public_by_ref`, `get_profiles_public`, `sitemap`, `og-*`). `REVOKE EXECUTE ... FROM anon, public` on the rest.
2. **7 public storage buckets with broad listing.** Replace the broad `SELECT` policy on `storage.objects` with `bucket_id = 'x' AND auth.uid() IS NOT NULL` (or a folder-prefix RLS for `medical-records`, `vet-docs`, `private-photos`). Public read of *individual* file URLs continues to work.
3. **4 extensions in `public` schema** (`pg_trgm`, `postgis`, `pgcrypto`, `vector`). Move to `extensions` schema; add it to `search_path` only where needed.
4. **Leaked-password (HIBP) protection** — turn on via `configure_auth(password_hibp_enabled: true)`.
5. **Re-run scan, drive count to ≤10 informational** warnings; document accepted risks in `@security-memory`.

Deliverable: clean scan report, one migration, one auth-config change.

---

## Phase 6 — Observability (1 session)

You cannot run production without eyes on it.

1. **Sentry (or equivalent)** for the React app + edge functions. Capture errors, breadcrumbs, releases. Wire to existing `installGlobalErrorHandlers`.
2. **`logError` everywhere** — replace remaining 4 `console.log` calls; standardise on the existing helper.
3. **Edge function logging** — every function should log `{ user_id, function, duration_ms, status }` on entry/exit.
4. **Lightweight product analytics** (PostHog or Plausible) — page views, signup funnel, post-create funnel, payment funnel. No PII.
5. **Health-check page** at `/__status` (admin-only) showing DB latency, edge-fn ping, queue depth.

Deliverable: a Sentry dashboard with zero unhandled errors during a 30-min smoke test.

---

## Phase 7 — Test safety net (1–2 sessions)

Today the repo has zero tests. We don't need 100% coverage; we need the parts that, if broken, lose a user or take payment incorrectly.

1. **Vitest setup** + a `bunx vitest` script.
2. **15 critical-path tests** (target, not ceiling):
   - `signup → create pet → create post → like → comment → message`
   - `forgot-password → reset → login`
   - `payment checkout → webhook → entitlement granted`
   - RLS sanity: `userA cannot SELECT userB's medical_records` (run via service-role test client)
   - Edge-fn input validation (zod) for every public function — reject malformed bodies with 400.
3. **CI gate**: tests must pass before publish (Lovable's build hook).

Deliverable: a green test suite that runs in <30s.

---

## Phase 8 — Storage strategy made explicit (½ session)

Document and enforce. Most of this is already correct; we are formalising it.

| Layer | Use for | Examples |
|---|---|---|
| `localStorage` | Tiny, non-sensitive, sync | Theme, last route, dismissed banners |
| `sessionStorage` | Per-tab cache | React Query persisted snapshot |
| IndexedDB (`idb-keyval`) | Larger client cache, drafts, offline queue | Post drafts, recent pets, queued likes |
| React Query memory | All API responses | (already in place) |
| Cloud DB (RLS) | Source of truth | Pets, users, posts, medical records |
| Cloud Storage (RLS) | Files | Photos, vet docs, voice notes |
| Service Worker cache | Static assets + image CDN | Avatars, post images, fonts |

Rules:
- **Never** store auth tokens, medical data, or private images in `localStorage` / IndexedDB.
- **Always** encrypt-at-rest by relying on Cloud (don't roll your own).
- Add `persistQueryClient` against `sessionStorage` so the feed paints instantly on revisit.

Deliverable: one `STORAGE.md` in repo + a small `lib/clientStore.ts` wrapper that enforces the rules.

---

## Phase 9 — Resilience & PWA polish (1 session)

Make it feel like Instagram on a flaky train.

1. **Service worker runtime caching** — cache-first for images (`stale-while-revalidate`, 7-day TTL), network-first for HTML.
2. **Offline queue** for like/follow/comment via IndexedDB; flush on `online` event. Optimistic UI is already in place; this just stops losing taps offline.
3. **Request retry with exponential backoff** in the supabase client wrapper for idempotent reads.
4. **Skeleton screens everywhere** (already partial: `FeedSkeleton`). Audit the 99 pages, add skeletons to the top 10 routes.
5. **Image pipeline** — confirm the `image-process` edge function generates `_thumb / _feed / _full`; backfill old posts with a one-shot job.

Deliverable: Lighthouse PWA score ≥ 90 on mobile.

---

## Phase 10 — Compliance, legal, launch checklist (½ session)

1. **Data export & delete** — `/settings/privacy → Export my data` (zip of all rows + files) and `Delete my account` (calls existing `delete-account` edge fn). Required by GDPR / DPDP.
2. **Cookie / consent banner** — only if you ship analytics. Use `vanilla-cookieconsent` or similar.
3. **Terms / Privacy / Refund** pages — reachable from footer + signup screen.
4. **Data-retention policy** — delete soft-deleted accounts after 30 days via a scheduled edge function.
5. **Status page** — public uptime page (BetterStack free tier, or hand-rolled).
6. **Launch checklist**: domain SSL, OG images, sitemap.xml (already an edge fn), robots.txt, App-store review screenshots if mobile.

Deliverable: a signed-off `LAUNCH.md` checklist.

---

## Suggested cadence

- Phase 5 + 6 in one sitting (security + observability are paired — fixing one without the other is half a job).
- Phase 7 next, before any new features.
- Phase 8 + 9 together (they share the storage/SW surface).
- Phase 10 right before publish.

Estimated total: **5–6 build sessions** to go from "fast beta" to "boring production".

---

## What I will NOT touch unless you ask

- The remaining 86 `select('*')` calls — they're in low-traffic settings pages. Real impact ≈ 0.
- React-window virtualization — at 12-post pages, no measurable benefit. Re-evaluate when users have 1000+ DM threads.
- A native mobile shell (Capacitor / Expo). PWA is enough for v1.
- Multi-region edge deployment. Not needed below ~100k MAU.

---

## What I need from you

Pick the next phase to ship:

- **"Phase 5"** — security cleanup (recommended; 1 session, high safety upside)
- **"Phase 5+6"** — security + observability bundled
- **"All"** — I sequence them and ship phase by phase, pausing for your QA between each
- **"Custom"** — tell me which phases and I'll start there

No new features in any of this — pure hardening.