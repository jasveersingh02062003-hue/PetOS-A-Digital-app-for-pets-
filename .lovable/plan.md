
# Sprint 2 — Finish what Sprint 1 started + Data, Cache, Metrics

Sprint 1 shipped image variants, `SmartImage`, `FeedSkeleton`, and the `image-process` edge function. But several items from the original plan were **never wired in**, and that's a big part of why the app still feels "basic and static". This sprint:

1. Finishes the Sprint 1 leftovers that were promised but not delivered
2. Adds the highest-impact items from your shortlist (feed caching, story loading, upload progress, perf metrics, CDN headers)

Everything below is a checklist so you can see exactly what's done vs pending.

---

## What's already shipped (no action)

- [x] DB columns `image_url_thumb/feed/full` on posts, pets, profiles, stories
- [x] `image-process` edge function (resize → 3 JPEG variants)
- [x] `SmartImage` component with shimmer + aspect lock
- [x] `FeedSkeleton`, `StoryRailSkeleton`, `ProfileSkeleton`
- [x] `uploadImageWithVariants` helper + Composer/ImageUpload wired
- [x] PostFeed uses SmartImage + FeedSkeleton

---

## A. Finish Sprint 1 leftovers (worth copying forward)

### A1. Use SmartImage everywhere, not just the feed
SmartImage exists but is **only used in `PostFeed`**. The rest of the app still shows raw 4 MB phone photos.

- [ ] `StoryRail.tsx` — story thumbnails use `variant="thumb"`
- [ ] `StoryViewer.tsx` — full-screen uses `variant="full"`
- [ ] `MissingStrip.tsx` + `MissingDetail.tsx` — `variant="feed"`
- [ ] `MatesGrid.tsx` + `Mates.tsx` cards — `variant="feed"`
- [ ] `PostGrid.tsx` (profile grid) — `variant="thumb"`
- [ ] `PetHeroCard.tsx` — pet avatar uses `variant="thumb"`
- [ ] `Avatar` wrappers in PostCard header — `variant="thumb"`

### A2. Real WebP encoding (not JPEG fallback)
The current `image-process` function writes `.jpg` because `imagescript` lacks a WebP encoder. Switch to `@squoosh/lib` or call a WebP-capable encoder. Saves another ~25% per image.

- [ ] Replace `imagescript` with WebP-capable encoder in `supabase/functions/image-process/index.ts`
- [ ] Change file extension and content-type to `.webp` / `image/webp`

### A3. Skeletons on the other pages
Sprint 1 promised skeletons "everywhere" but only the feed got one.

- [ ] Use `ProfileSkeleton` in `Profile.tsx` and `UserProfile.tsx` while `useProfile` is loading
- [ ] Use `StoryRailSkeleton` in `StoryRail.tsx` while stories load (instead of empty 88px box)
- [ ] Add `DiscoverSkeleton` for `Discover.tsx` (mates + groups grid placeholders)
- [ ] Add `MeetupsSkeleton` for `Meetups.tsx`

### A4. Replace remaining `<Loader2>` spinners
Spinners are the #1 "vibe-coded" tell.

- [ ] Search for `Loader2` across `src/pages` — replace blocking-screen spinners with skeleton variants
- [ ] Keep small inline spinners (button loading states) — those are fine

---

## B. Data efficiency & caching (the actually-fast part)

### B1. One combined `get_home_data` RPC
Today the Home screen fires ~6 separate Supabase queries (profile, pets, stories, daily prompt, missing strip, feed). One combined RPC = one network round-trip.

- [ ] New SQL function `public.get_home_data(_user_id uuid)` returning JSONB with `{profile, pets, stories, prompt, missing, feed_first_page}`
- [ ] New hook `useHomeData()` that calls this RPC once
- [ ] Update `Home.tsx` to consume it; keep child queries as cache hydrators only

### B2. Persistent cache (offline-first opens)
Right now every cold launch refetches everything. Add `@tanstack/react-query` IndexedDB persister so the previous session's data renders **instantly** on launch, then refreshes in background.

- [ ] Install `@tanstack/query-sync-storage-persister` + `@tanstack/react-query-persist-client`
- [ ] Configure persister in `App.tsx` with IndexedDB adapter (24 h max age)
- [ ] Mark sensitive queries (`auth`, `notifications`) as `persist: false`

### B3. Feed prefetch + infinite scroll
Sprint 1 promised this but never landed it.

- [ ] Convert `PostFeed.tsx` to `useInfiniteQuery` (10 posts/page)
- [ ] Trigger next-page fetch via IntersectionObserver on the last card
- [ ] (Optional) react-window virtualization — only if scroll still janks after pagination

---

## C. Story & avatar loading

### C1. Story rail
- [ ] Use `SmartImage variant="thumb"` for story rings
- [ ] Preload the next 3 story `full` URLs when a viewer opens a story (avoids the white-flash between stories)
- [ ] Add `<link rel="preconnect">` to the storage host in `index.html`

### C2. Avatar variants
- [ ] When uploading a profile/pet avatar, store all 3 variants in `image_url_thumb/feed/full` columns (currently only the `feed` URL is saved into the legacy `avatar_url`)
- [ ] Update `Avatar` usages to read `_thumb` first

---

## D. Upload progress UI

- [ ] Add an `onProgress` callback to `uploadImageWithVariants` (XHR-based, `supabase.functions.invoke` doesn't expose progress — use direct `fetch` with `ReadableStream` or upload stage indicator: "Uploading… → Optimizing… → Done")
- [ ] Show a determinate `<Progress>` bar in `Composer.tsx` and `ImageUpload.tsx`
- [ ] Optimistic preview: show the local `URL.createObjectURL(file)` thumbnail immediately while the server processes

---

## E. CDN-style headers & static perf

- [ ] Confirm `image-process` writes `Cache-Control: public, max-age=31536000, immutable` (it already does — verify in browser devtools)
- [ ] Add `Cache-Control` headers to the SW (`public/sw.js`) for image responses
- [ ] Add `<link rel="preconnect" href="<storage-host>">` and `<link rel="dns-prefetch">` in `index.html`
- [ ] Set `decoding="async"` and `loading="lazy"` defaults inside `SmartImage` (verify they are still present)

---

## F. Performance metrics (so we know it actually got faster)

- [ ] Tiny `src/lib/perf.ts` that logs Core Web Vitals (LCP, FID, CLS, TTFB) using the `web-vitals` package
- [ ] Send to a new `perf_events` table (user_id, route, metric, value, ts) for self-measurement
- [ ] Simple admin view at `/admin/perf` showing p50/p95 LCP per route over the last 7 days

---

## Implementation order (so you see wins fast)

```text
Day 1: A1 (SmartImage everywhere) + A3 (skeletons everywhere)   <- biggest visual win
Day 2: B1 (get_home_data RPC) + B2 (IndexedDB persist)          <- biggest "feels instant" win
Day 3: B3 (infinite scroll) + C1 (story preload) + D (progress) <- polish
Day 4: A2 (real WebP) + E (CDN headers) + F (metrics)           <- measurable proof
```

---

## Out of scope (Sprint 3)

- Cloudflare/Bunny CDN in front of storage
- Capacitor native wrap for true 60fps
- Server-side rendering of the first feed page
- Push notification batching

---

Approve and I'll start with **Day 1** (SmartImage everywhere + skeletons everywhere) since that's the change you and your friends will see immediately on the next refresh.
