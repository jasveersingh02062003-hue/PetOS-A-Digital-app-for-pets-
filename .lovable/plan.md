## Day 1: SmartImage + Skeletons Everywhere

Roll out the existing `SmartImage` component and skeleton screens across the app so every image fades in cleanly and every loading state shows a shimmer instead of a spinner. This is the change you and your friends will notice on the next refresh.

### Checklist

**SmartImage rollout (7 files)**
- [ ] `src/components/social/StoryRail.tsx` — story ring avatars
- [ ] `src/components/social/StoryViewer.tsx` — full-screen story media
- [ ] `src/components/MissingStrip.tsx` — missing-pet thumbnails
- [ ] `src/components/MatesGrid.tsx` — pet cards
- [ ] `src/components/social/PostGrid.tsx` — profile post grid
- [ ] `src/components/home/PetHeroCard.tsx` — hero pet image
- [ ] `src/components/Composer.tsx` / preview surfaces — author avatars

**Skeleton rollout**
- [ ] Create `src/components/skeletons/StoryRailSkeleton.tsx`
- [ ] Create `src/components/skeletons/GridSkeleton.tsx` (reusable for Mates / Discover / Profile)
- [ ] Create `src/components/skeletons/ProfileSkeleton.tsx`
- [ ] Wire `StoryRailSkeleton` into `StoryRail.tsx` initial load
- [ ] Replace `Loader2` spinners in `MatesGrid.tsx` with `GridSkeleton`
- [ ] Replace spinners in `Profile.tsx` with `ProfileSkeleton` + `GridSkeleton`
- [ ] Replace spinner in `Discover.tsx` with `GridSkeleton`
- [ ] Replace spinner in `Meetups.tsx` with list skeleton

**Data fetch updates**
- [ ] Update `PostGrid.tsx` query to select `image_url_thumb`, `image_url_feed`, `image_url_full` so it can pass variants to `SmartImage` (falls back to legacy `image_url`)

### Technical notes

- `SmartImage` already accepts `thumb` / `feed` / `full` props and falls back to a single `src`. For surfaces without variant columns yet (stories, missing pets, mates, avatars), pass the legacy URL as `src` — they still get the fade-in + aspect-ratio lock + lazy loading benefit.
- Skeletons use existing `Skeleton` from `src/components/ui/skeleton.tsx` with brand-tinted shimmer to stay on design system. No new colors.
- No DB migration needed — variant columns already exist on `posts` from Sprint 1.
- No new dependencies.

### Out of scope (deferred to Day 2+)

- One-shot home query + IndexedDB cache (Sprint 2 B1/B2)
- Story upload pipeline migration to `uploadImageWithVariants`
- CDN cache headers, web-vitals instrumentation