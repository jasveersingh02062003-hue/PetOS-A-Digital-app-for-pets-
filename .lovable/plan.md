# Sprint 1 — Images & Speed

Goal: make the app **feel dramatically faster** by fixing the #1 bottleneck — full-size images served from a single region — and removing the "blank → spinner → flash" feeling that says "vibe-coded".

This sprint touches the **3 highest-leverage levers** without rewriting the app.

---

## What changes for the user

- Feed scroll uses **70% less data** and loads images **3-5× faster**
- Avatars/stories/cards show **instantly** with blurred placeholders (no more grey squares)
- App opens to **skeleton layouts** instead of empty spinners — feels instant
- Smooth scrolling even with hundreds of posts (no jank)

---

## The 3 fixes

### Fix 1 — Auto-resize & WebP convert every uploaded image

**Today:** A user uploads a 4 MB photo from their phone → that **same 4 MB JPEG** is shown in the feed, profile, and stories. One feed scroll downloads 20–50 MB.

**After:** Every upload goes through a new edge function that produces 3 sizes in modern WebP format:

| Size | Width | Used in |
|---|---|---|
| `thumb` | 200px | Avatars, story rail, comment author, pet chips |
| `feed` | 720px | Feed cards, profile grid, missing strip |
| `full` | 1440px | Story viewer, full-screen photo, post detail |

Each variant is ~60% smaller than the original JPEG. Combined savings: **~85% on the feed**.

### Fix 2 — Skeleton screens + blur placeholders everywhere

**Today:** Blank screen → spinner → content appears (perceived as "slow + broken").

**After:**
- Home, Profile, Discover, Feed, Stories, Mates render **skeleton shapes** matching the final layout while data loads
- Every image has a tiny base64 blur or solid color while the WebP loads (no more grey jumps)
- Reserved aspect-ratio so layout never shifts

Perception-wise, this is the **biggest "feels premium" win** — users stop noticing load time.

### Fix 3 — Virtualize the feed + prefetch next page

**Today:** All 50 posts render at once. With long captions + images, that's hundreds of DOM nodes. Scroll stutters on mid-range Android.

**After:**
- Use `react-window` (already lightweight, ~6 KB) to render only **visible posts + 2 buffer**
- Infinite scroll pagination (10 posts per page instead of 50 upfront)
- Prefetch page 2 while user is reading page 1 → next batch appears instantly

---

## Technical changes

### New edge function: `image-process`
- Accepts an uploaded original from the client
- Uses `https://deno.land/x/imagescript` (pure-Deno, no native deps) to resize + WebP-encode
- Writes 3 variants to the existing storage bucket under `<userId>/<uuid>/{thumb,feed,full}.webp`
- Returns the 3 URLs as JSON

### Update `src/components/ImageUpload.tsx`
- Replace direct `supabase.storage.upload()` with `supabase.functions.invoke('image-process', { body: file })`
- Returns `{ thumb, feed, full }` — store all 3 URLs (or a single base path + variant suffix)
- Show local preview immediately while processing in background (optimistic UI)

### DB migration
- Add nullable columns `image_url_thumb text`, `image_url_feed text`, `image_url_full text` to `posts`, `pets`, `profiles` (avatar variants), `stories`
- Backfill: leave old `image_url` as fallback — new uploads populate the new columns
- No breaking changes; old posts keep working

### New component: `<SmartImage>`
- Wraps `LazyImage` with variant selection: `<SmartImage src={post} variant="feed" />`
- Picks the right URL automatically (`feed` if available, fall back to `image_url`)
- Adds `srcset` for retina displays
- Includes solid-color blur placeholder

### Skeleton components
- `src/components/skeletons/FeedSkeleton.tsx`
- `src/components/skeletons/ProfileSkeleton.tsx`
- `src/components/skeletons/StorySkeleton.tsx`
- Replace existing `<Loader2 spinner>` usages on Home, Profile, Discover, Feed

### Virtualized feed
- Add `react-window` dep
- Refactor `PostFeed.tsx` to use `useInfiniteQuery` (10 posts/page) + `<VariableSizeList>`
- Prefetch next page when user scrolls past 70%

### Files affected
- **New**: `supabase/functions/image-process/index.ts`, `src/components/SmartImage.tsx`, `src/components/skeletons/*.tsx`, migration for image variant columns
- **Edited**: `ImageUpload.tsx`, `PostFeed.tsx`, `Home.tsx`, `Profile.tsx`, `Discover.tsx`, `StoryRail.tsx`, `MissingStrip.tsx`, `MatesGrid.tsx`, `Composer.tsx`, `vite.config.ts` (add react-window chunk)

---

## Out of scope (saved for Sprint 2 & 3)

- Combined `get_home_data` RPC → Sprint 2
- IndexedDB cache for offline-first opens → Sprint 2
- Cloudflare/Bunny CDN in front of storage → Sprint 2
- Capacitor native wrap → Sprint 3
- Cloud instance upgrade → only if usage data justifies it

---

## Expected outcome

- **Feed time-to-first-image**: ~2.5s → ~600ms on 4G
- **Feed payload**: ~15 MB → ~2 MB for 10 posts
- **Perceived load time** (user-visible): cut roughly in half thanks to skeletons
- **Scroll FPS** on mid-range Android: 30-40 → 55-60

Approve and I'll ship the entire sprint in one pass.
