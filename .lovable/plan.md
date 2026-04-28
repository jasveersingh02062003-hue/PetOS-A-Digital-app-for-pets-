# Discover redesign — big-box, scroll-first

## The problem with the current screen
Right now Discover front-loads two hero tiles, then a row of small colored chips, then a 4-tab feed (Trending / Latest / Near me / Mates). Services are hidden one tap deep behind a single "Services near you" tile. Categories like Vets, Grooming, Daycare, Caretakers don't appear visually until you drill in.

You want the opposite: the moment a user lands on Discover, they should **see every service as a large tile** and just scroll. Search is the fallback, not the primary path.

## New journey
```
Discover
  ├── Search bar (fallback)
  ├── BIG BOX  Find a mate
  ├── BIG BOX  Ask a vet
  ├── BIG BOX  Grooming near me
  ├── BIG BOX  Vets near me
  ├── BIG BOX  Daycare
  ├── BIG BOX  Caretakers
  ├── BIG BOX  Training centers
  ├── BIG BOX  Boarding
  ├── BIG BOX  Sitters
  ├── BIG BOX  Walkers
  ├── BIG BOX  Pet taxi
  ├── BIG BOX  Meetups
  ├── BIG BOX  Groups
  ├── BIG BOX  Missing pets
  └── (feed tabs move below, optional)
```

Tap any big box → goes straight to that category's landing page (already built at `/services/category/:category`) which has distance sort, verified filter, price filter and the provider list/map. So the wiring is already there — this is purely a Discover-page restructure.

---

## What's already implemented (no work needed)
- `/services/category/:category` landing page with sort + filter + list
- `/discover/services` hub page (we'll keep it but Discover itself absorbs its role)
- `SERVICE_CATEGORIES` metadata (9 categories, icons, tones)
- `useUserLocation` hook + `nearby_providers` RPC
- All routes for askvet, meetups, groups, missing, mates

## What's missing (this plan)
- Discover page restructured into a vertical big-box grid
- Each big box shows: large icon, title, one-line subtitle, and (when location is on) a live "X near you" count
- Search bar stays at the top as the explicit fallback
- Feed tabs (Trending / Latest / Near me / Mates) demoted to the bottom of the page (or removed — see question below)

---

## Implementation phases (no overlap)

### Phase 1 — Restructure Discover layout (the visible change)
- Replace the current 2-hero + chip-row + tabs block with one vertical 2-column big-box grid.
- Each tile ~half-screen-width, ~120px tall, rounded-3xl, gradient background using existing tone tokens (coral / sky / leaf / amber / lilac / primary).
- Tile order (priority-driven):
  1. Find a mate
  2. Ask a vet
  3. Grooming
  4. Vet clinics
  5. Daycare
  6. Caretakers
  7. Training
  8. Boarding
  9. Sitters
  10. Walkers
  11. Pet taxi
  12. Meetups
  13. Groups
  14. Missing pets
- Search bar pinned just under the page header.
- Trending hashtags rail + LocalPack rail kept above the grid (they're social discovery, not service discovery).

### Phase 2 — Live "near you" counts on each service tile
- One batched query on mount: when `coords` exist, call `nearby_providers` once, group results by category, show "12 near you" badge on each relevant tile.
- For non-service tiles (Mates, Meetups, Groups, Missing) skip the count.
- Graceful fallback when location is off: show "Tap to enable location" subtitle instead of count.

### Phase 3 — Wiring + cleanup
- Each service tile → `/services/category/:key`
- Find a mate → `/mates`
- Ask a vet → `/askvet`
- Meetups → `/meetups`, Groups → `/groups`, Missing → `/missing`
- Decide fate of the old feed tabs (Trending / Latest / Near me / Mates) — see question.
- `/discover/services` becomes a redirect to `/discover` (or kept as the same grid, since Discover now contains it).

### Phase 4 — QA
- Verify each tile routes correctly.
- Verify counts render only when location is granted.
- Verify mobile (375px) — tiles must stay 2-column and tappable.
- Verify scroll feel — no horizontal scroll, no clipped text.

---

## Technical notes
- New file: none required. Edit `src/pages/Discover.tsx` only.
- Reuse `SERVICE_CATEGORIES` from `src/lib/serviceCategories.ts` — do not redefine.
- Reuse `useUserLocation` hook for the live count query.
- Reuse `TONE_BG` tokens; add a `TONE_GRADIENT` map for big-box backgrounds.
- Keep the existing `HeroTile` component pattern but make it the only tile primitive (drop `ChipTile`).
- The "Find a mate" and "Ask a vet" tiles are not in `SERVICE_CATEGORIES` — render them as a small hand-curated array prepended to the grid.

## One question before I build
The current Discover has a 4-tab feed at the bottom (Trending posts / Latest / Near me / Mates). Three options:
1. **Keep it below the big-box grid** — users scroll past tiles, then see social feed.
2. **Remove it entirely** — Discover becomes purely a launcher; social feed lives on Home.
3. **Move it to its own `/discover/feed` tab.**

I'd recommend **option 1** (keep below) — it preserves the social discovery without competing with the big boxes. Confirm or pick another.
