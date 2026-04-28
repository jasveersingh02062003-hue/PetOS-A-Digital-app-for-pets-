# Why Petos feels slow — and what to fix

## TL;DR

The backend is **not** the bottleneck. Your database is essentially empty (4 profiles, 9 posts, 13 pets, 2 missing pets) and all hot tables have proper indexes. The slowness you feel is **100% frontend**: the Home screen fires ~10 parallel queries and mounts ~12 heavy components on first paint, on a mobile viewport (393×667), through a dev preview iframe.

## Where your data is stored

Everything runs on **Lovable Cloud** (managed Postgres + Storage + Auth + Edge Functions):

| Data | Location |
|---|---|
| Users / sessions | `auth.users` (Lovable Cloud Auth) |
| Profiles, pets, posts, comments, reactions, follows, meetups, missing pets, notifications, etc. | Postgres tables in `public` schema |
| Photos (avatars, post images, stories, missing-pet photos) | Lovable Cloud Storage buckets (`stories`, post media, etc.) |
| Push / notification jobs | `notifications` + `notification_jobs` tables |
| AI chat, push send, vault, billing | Edge Functions (`ai-photo-analyze`, `chat`, `send-push`, `stripe-webhook`, ...) |

Realtime subscriptions are wired for `notifications` (per-user) and `posts` (feed).

## Evidence — what I actually measured

**DB sizes (live):** every table is 8 KB. There is no data volume problem.
```
posts=9   profiles=4   pets=13   missing_pets=2
notifications=9   post_reactions=3   meetups=5
```

**Indexes:** `posts(created_at DESC)`, `posts(author_id)`, `notifications(user_id, created_at DESC)`, `missing_pets(status, last_seen_city)`, geo GIST on meetups/missing — all present. Backend reads are O(milliseconds).

**Home screen network fan-out on first paint** (everything fires in parallel, before paint completes):
1. `useProfile` → profiles
2. `usePets` → pets
3. `useUpcomingMeetups(city)` → meetups
4. `HomeHero` → signals query
5. `HealthStatusStrip` → vitals/vaccinations
6. `PharmacySuggestionsBanner` → meds
7. `StoryRail` → stories + `get_profiles_public` RPC (full table scan returned, then filtered client-side)
8. `DailyPromptBanner` → daily_prompts
9. `MissingStrip` → missing_pets + `get_pets_public` RPC
10. `DailyTipCard` → tip
11. `PostFeed` (For-you) → posts + `get_profiles_public` (again) + pets
12. `PostFeed` (Following) — *also mounts immediately* because it's inside `<TabsContent>` and not lazy. So the feed query runs **twice**.

**Compounding factors:**
- `PostFeed` calls `supabase.rpc("get_profiles_public")` which `SELECT id, full_name, avatar_url, city, bio FROM profiles` (no filter, no limit) and filters client-side. Same RPC is called by `StoryRail`, `MissingStrip`, etc. — **no React Query dedup** because each call runs inside a different `queryFn`.
- `useActiveStories` has `refetchInterval: 60_000` → forces a re-query + re-render every minute.
- Realtime channel on `posts` invalidates the **entire `["feed"]`** cache on any change, refetching both tabs.
- All 5 tab-bar pages (`Home`, `Discover`, `Health`, `Services`, `Profile`) are **eagerly imported** in `App.tsx`, so the initial JS bundle is large even though the user only sees Home.
- Service worker is registered in production — if you've visited before, you may be running **stale cached JS** while new modules load on top.
- Dev preview iframe adds 200–500 ms of extra overhead vs. the published URL.

## Fix plan (ordered by impact)

### 1. Cut Home's first-paint query fan-out (biggest win)
- Make `PostFeed` for the inactive tab **lazy** — only mount the active `<TabsContent>` (use `forceMount={false}` default and conditional render based on `activeTab` state). Eliminates the duplicate feed query.
- Defer below-the-fold widgets to after first paint with `<Suspense>` + `lazy()`:
  - `StoryRail`, `DailyPromptBanner`, `MeetupCard`, `DailyTipCard`, `PharmacySuggestionsBanner`, `MissingStrip`.
- Lift `staleTime` for non-critical home widgets (tip, meetups, pharmacy, prompt) to 5 min.
- Remove `refetchInterval: 60_000` from `useActiveStories` (rely on user pull-to-refresh / mount).

### 2. Centralise the `get_profiles_public` RPC
- Add a single `useProfilesPublic()` React Query hook with `queryKey: ["profiles-public"]` and `staleTime: 5 min`. Have `PostFeed`, `StoryRail`, `MissingStrip`, `Discover` consume it instead of calling the RPC inside their own `queryFn`. Cuts 3–4 round-trips on Home.
- Same for `get_pets_public` used by `MissingStrip`.

### 3. Code-split the tab-bar pages
- Convert `Discover`, `Health`, `Services`, `Profile` from eager imports to `lazy(() => import(...))` in `App.tsx`. Only Home needs to be eager. Shrinks initial JS by an estimated 30–40%.

### 4. Tame realtime invalidations
- In `PostFeed`'s posts channel, scope invalidation to the current scope key (`["feed", scope, ...]`) instead of blasting all `["feed"]` queries. Avoids refetching both tabs on every insert.

### 5. Service-worker hygiene
- In `public/sw.js`, ensure the install handler calls `self.skipWaiting()` and activate calls `clients.claim()` + deletes old caches by version key. If users are loading stale shells we'll see slow first paint until SW updates.

### 6. Image performance
- Add `decoding="async"` and explicit `width`/`height` to `<img>` in `PostFeed`, `StoryRail`, `MissingStrip` to avoid layout thrash and let the browser parallelise decode.
- The post image container is `aspect-square` already — good. Confirm uploads go through a resized variant (currently `image_url` is the raw upload — if originals are >1 MB on a 393px viewport, that alone explains "slow scrolling").

### 7. Optional but recommended
- Add a tiny `console.time` around Home's `useEffect` queries in dev so we can measure the change.
- Run `browser--performance_profile` after the fixes to confirm Web Vitals improvement.

## What I will NOT change in this pass
- Database schema, RLS, indexes (already healthy).
- Edge Functions (not on the Home critical path).
- Lovable Cloud instance size — your data is tiny; upgrading would not help.

## Verification checklist (after implementation)
- [ ] Home first paint mounts only: header, HomeHero, QuickAccessRail, active feed tab. Everything else lazy.
- [ ] Network tab shows ≤ 5 Supabase requests on Home cold load (down from ~10).
- [ ] Switching For-you ↔ Following triggers exactly **one** new feed query, not both at mount.
- [ ] `get_profiles_public` is requested **once** per cold load (verified via Network filter).
- [ ] Initial JS chunk for `/` route is smaller (Vite build output).
- [ ] No console warnings about duplicate Supabase channels.

Approve and I'll execute the whole pass in one go.
