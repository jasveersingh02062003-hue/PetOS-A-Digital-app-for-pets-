
# Petos Home — The "Stop Being a Clone" Rebuild

## Honest verdict on what's live

The current Home is a **dashboard pretending to be a social app**. Five surfaces above the fold (greeting → goal chips → pet card with 3 CTAs → SOS ribbon → composer → 6-icon grid → 3 tabs) before a single piece of social content. Generic "Hi joe" greeting. No app logo. No signature scroll. The "social" tab is a list of square cards — indistinguishable from any pet-themed Instagram clone.

Score today: **5.5 / 10**. Functional. Forgettable.

## What we are stealing (and what we are not)

| From | What we take | What we ignore |
|------|-------------|----------------|
| Instagram | Story rail at top, double-tap to react | The square-grid feed (overdone) |
| TikTok | Vertical full-bleed feed, one moment per screen, infinite swipe | The algorithmic creator economy |
| Strava | Streaks, weekly leaderboards, kudos as a status symbol | The fitness obsession framing |
| BeReal | Daily prompt creates FOMO + one-shot posting | The 2-minute window gimmick |
| LinkedIn | Verified badges as social currency | The corporate tone |

**The unique twist nobody else has:** every post is provably tied to a real, verifiable pet (vaccines, lineage, walks). The flex isn't followers — it's **receipts**.

---

## The new Home — three modes, one screen

```text
┌────────────────────────────────────┐
│  🐾 petos          🔍   🔔         │  ← signature top bar (logo + search + bell)
├────────────────────────────────────┤
│  ╭──╮ ╭──╮ ╭──╮ ╭──╮ ╭──╮ ╭──╮     │  ← story rail: pets you follow + "+ Share"
│  │+ │ │🐕│ │🐱│ │🐕│ │🐕│ │🐕│     │     pulsing dot if you haven't posted in 24h
│  ╰──╯ ╰──╯ ╰──╯ ╰──╯ ╰──╯ ╰──╯     │
├────────────────────────────────────┤
│  For you │ Tribe │ Nearby          │  ← 3 tabs (no "Following" — collapsed into Tribe)
├────────────────────────────────────┤
│                                    │
│   ╔══════════════════════════════╗ │
│   ║                              ║ │
│   ║   FULL-BLEED PET MOMENT      ║ │  ← one moment per screen, 4:5 portrait
│   ║                              ║ │     swipe up = next, double-tap = boop
│   ║   ╭──────────────────────╮   ║ │     reactions float over image
│   ║   │ 🐕 PUBG · 7y · ✓vax  │   ║ │
│   ║   │ "first day at beach" │   ║ │  ← identity plate already exists
│   ║   ╰──────────────────────╯   ║ │
│   ║   🐾 12   💬 4   🔖   ↗      ║ │
│   ╚══════════════════════════════╝ │
│                                    │
└────────────────────────────────────┘
```

**Killed for good:**
- "Hi, joe" greeting → moved to Profile tab only
- "Personalised for: Social / Mates …" chip strip → deleted (it shows the user their own onboarding answers)
- Pet hero card with 3 CTAs above the feed → moved to a **swipe-down "Today" panel** accessible from the avatar in the top-bar
- Emergency SOS ribbon → already a floating dot bottom-right; remove the ribbon
- "Share funny's morning" composer card → replaced by the **+ tile in the story rail** (Instagram pattern)
- 6-icon quick-action grid → moved into a **"More" sheet** behind a single icon in the top-bar
- "Following" tab → folded into "Tribe" (people + groups + tribes you're in)
- "Trending" tab → renamed "Nearby" (geo-bounded; we have city/lineage data — competitors don't)

---

## The five things that make it not-a-clone

### 1. Brand identity in the top bar
Add a real `Petos` wordmark + paw-leaf glyph on the left of the top-bar. Search on the right. Bell after that. **One bar. Three elements. That's the entire chrome.** This alone removes 70% of the "white-label" feel.

### 2. Vertical full-bleed feed (TikTok pattern)
Today the feed is a list of cards in a scrollable column. Change to **one moment per viewport** with snap-scroll. The Pet Identity Plate (already built) overlays the bottom of the photo. Reactions float on the right edge (TikTok-style vertical action rail). Swipe up = next moment. This is the addictive loop competitors haven't done for pets.

### 3. Per-pet vertical feed (the "follow a pet" hook)
Tap any pet's avatar/name → enter **their** vertical feed (their last 30 moments only). Like TikTok's per-creator scroll. This makes following a pet feel like following a *show*, not a person. Pets become characters.

### 4. The "Tribe" tab — the moat
Replaces "Following". Shows posts from:
- Pets in your **city** (Hyderabad Goldens, Bangalore Indies)
- Pets of your **breed** (all Labradors)
- Pets in your **groups**
Powered by `pet_snapshot.city` + `pet_snapshot.breed` already on `posts`. **No other pet app does locality+breed feeds.** This is the USP made tangible.

### 5. Signature interactions
- **Double-tap any moment** → boop (paw-print ripple, haptic)
- **Long-press the boop area** → radial reaction picker (already built, wire it in)
- **Swipe right on a moment** → save to private vault
- **Swipe left** → "see more like this" (per-pet feed)
- **Streak chip** auto-flexes when a pet hits 7/30/100-day walk streak (auto-share card)

---

## What to build (technical)

### Files to create
- `src/components/social/HomeTopBar.tsx` — wordmark + glyph + search + bell. Sticky. ~64px.
- `src/components/social/VerticalFeed.tsx` — snap-scroll container, one card per viewport, swipe-up = next. Replaces the column layout in `PostFeed.tsx` only on the Home tab.
- `src/components/social/VerticalActionRail.tsx` — TikTok-style right-edge column: avatar, boop, comment, save, share. Floats over media.
- `src/components/social/TodayPanel.tsx` — the swipe-down (or avatar-tap) panel that holds today's pet card, vaccinations CTA, quick actions. Removes them from the always-visible scroll path.
- `src/components/brand/PetosWordmark.tsx` — SVG wordmark in `font-display`, paw-leaf glyph beside it.
- `src/components/social/PetVerticalFeed.tsx` — route `/pet/:id/feed` — full-screen, last 30 moments of a single pet.

### Files to change
- `src/pages/home/PetParentHome.tsx` — strip greeting, goal chips, pet hero, SOS ribbon, composer card, quick-action grid, 3-tab strip. Replace with `<HomeTopBar /> + <StoryRail /> + <TabsBar tribe|foryou|nearby /> + <VerticalFeed />`.
- `src/components/PostFeed.tsx` — accept `layout="vertical" | "list"` prop. Vertical mode renders snap-scroll children with `VerticalActionRail`. List mode keeps current cards (used in profile, hashtag, search).
- `src/components/social/StoryRail.tsx` — pulsing "+ Share" tile only when user hasn't posted in 24h.
- `src/components/home/PetHeroCard.tsx` — keep the component, but mount it inside `TodayPanel` instead of always-on Home.
- `src/components/home/EmergencyButton.tsx` — already slim; remove the ribbon entirely from Home, keep only the floating dot.
- `src/App.tsx` — add route `/pet/:id/feed` → `PetVerticalFeed`.

### Backend additions (small, additive)
- **`get_nearby_posts(city text, limit int)`** RPC — returns posts where `pet_snapshot->>'city' = city`, ordered by recency × reactions. Powers the "Nearby" tab.
- **`get_tribe_posts(user_id uuid)`** RPC — union of: posts from groups the user joined + posts from pets matching their pet's breed + posts from their city.
- **`pet_streaks` view** — per-pet computed `current_streak_days` from walk sessions. Surfaces auto-flex moments ("PUBG hit 30 days 🔥").
- No schema changes required — everything else is read-only views and RPCs.

### Brand assets
- One SVG wordmark (`/public/brand/petos-wordmark.svg`) — `Petos` in Fraunces with the `o` styled as a paw print.
- Glyph (`/public/brand/petos-glyph.svg`) — the paw print alone for favicon/PWA.

---

## Order of execution

1. **Backend RPCs + view** (15 min) — `get_nearby_posts`, `get_tribe_posts`, `pet_streaks`.
2. **Brand bar** (`HomeTopBar` + wordmark SVG) (20 min) — instant identity win.
3. **Strip Home** — delete greeting, goal chips, hero, SOS ribbon, composer, quick grid (10 min).
4. **TodayPanel** — re-home the deleted-from-feed surfaces behind a swipe/avatar tap (30 min).
5. **VerticalFeed + VerticalActionRail** — the main visual shift (45 min).
6. **Tribe + Nearby tabs** wired to the new RPCs (20 min).
7. **PetVerticalFeed route** + tap-pet-name navigation (20 min).
8. **Signature interactions** — double-tap boop + swipe-right save + swipe-left "more like this" (20 min).

Total: one continuous build, ~3 hours of work shipped in one pass.

## What I will NOT touch

- Other role dashboards (BreederHome, ShelterHome, etc.) — only `PetParentHome`.
- Auth, payments, routing graph (apart from one new route).
- Existing post composer, story viewer internals, comment sheet — only restyled if they clash.
- The pet card design itself (already redesigned last pass — it's good, just in the wrong place).

## How we'll know it worked

- Side-by-side with Instagram's home: the brand bar, story rail, and **vertical full-bleed feed** are immediately distinguishable.
- "Hi, joe" and the goal chip strip are gone.
- One tap on a pet name takes you into that pet's vertical feed (the "follow a show" hook).
- The Tribe tab shows posts from your breed/city — something Instagram structurally can't do.
- Time-on-feed (sessions > 60s) measurable via existing analytics events.

Approve and I'll start with the backend RPCs, then ship steps 2–8 in one continuous build.
