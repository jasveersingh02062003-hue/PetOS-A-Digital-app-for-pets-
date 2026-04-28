# Plan — Delightful Interaction Animations

Goal: make every social tap feel alive. Headline feature: **double-tap a photo → big paw 🐾 burst + auto-react with "love"**. Plus a coordinated polish pass on the existing buttons so the feed feels playful and consistent.

Stack already in place: `framer-motion`, `tailwindcss-animate`, `sonner`, `navigator.vibrate` via `src/lib/haptics.ts`. No new deps needed.

---

## 1. Double-tap "Paw Burst" on post images (headline)

**New component** `src/components/social/PawBurst.tsx`
- Imperative API: `usePawBurst()` returns `{ burst(x, y), node }`.
- Renders a giant centered 🐾 that scales 0 → 1.3 → 1, fades out (~700ms, framer-motion `AnimatePresence`).
- Around it: 6 smaller paws fly outward in a radial pattern with random rotation (staggered 0–120ms).
- Pointer-events: none, absolutely positioned over image.

**Wire-up in `src/components/PostFeed.tsx` `PostCard`:**
- Wrap the image `<div>` with `onClick` detecting double-tap (track `lastTapRef`, threshold 280ms).
- On double-tap:
  1. Trigger paw burst at tap coordinates.
  2. Fire `haptic(15)`.
  3. If user has no current reaction → call same `toggle("love")` logic from `ReactionBar` (extract a tiny shared helper `addReaction(postId, "love")` in `src/lib/reactions.ts` so PostCard can call it without duplicating code).
  4. If user already reacted → only animate (no toggle off — matches Instagram behavior).
- Single tap: do nothing (preserves accidental taps).

**Edge cases**
- Guard for unauthenticated users → still play animation, but skip mutation and show subtle toast "Sign in to react".
- Disable on long-press / drag (use a movement threshold of 8px between touchstart and touchend).

---

## 2. Reaction button micro-animations (`ReactionBar.tsx`)

- When user picks a reaction in the popover: emoji **pops** (scale 1 → 1.4 → 1, 250ms) and the trigger button gets a soft `primary-soft` ring pulse for 400ms.
- Counter number animates with a subtle slide-up when it changes (framer-motion `key={total}` + `initial={{y:6, opacity:0}}`).
- Add `haptic(10)` on selection.

## 3. Save (bookmark) animation (`SaveButton.tsx`)

- On save: bookmark icon scales 0.8 → 1.25 → 1 (300ms) and a tiny gold sparkle (✦) fades in/out above it.
- On unsave: gentle shrink-and-fade.
- `haptic(8)` on toggle.

## 4. Follow button animation (`FollowButton.tsx`)

- On follow success: button briefly morphs — checkmark icon slides in from left, label crossfades from "Follow" → "Following", subtle confetti dot burst (3 dots, 350ms).
- Use framer-motion `layout` + `AnimatePresence` for the icon/label swap.

## 5. Comment button bounce (`PostFeed.tsx`)

- Tapping the comment icon → quick scale 1 → 1.15 → 1 (150ms) before the sheet opens. Pure CSS via `active:scale-110 transition-transform`.

## 6. Bottom nav tap feedback (`BottomNav.tsx`)

- Active tab icon gets a small "lift + bounce" when first selected (framer-motion `whileTap={{scale:0.9}}` and `animate={{y: active ? -2 : 0}}`).
- Adds `haptic(8)` on tab change.

## 7. Tailwind keyframes (one-time additions in `tailwind.config.ts`)

Extend `keyframes` + `animation` with:
- `paw-pop`: scale 0 → 1.3 → 1, opacity 0 → 1 → 0 (700ms).
- `paw-fly`: translate + rotate radial outward, fade (600ms).
- `pop`: scale 1 → 1.25 → 1 (220ms).
- `sparkle`: opacity + translateY pulse (500ms).

These give us reusable `animate-paw-pop`, `animate-pop`, `animate-sparkle` classes for non-framer cases.

---

## Files touched

**New**
- `src/components/social/PawBurst.tsx`
- `src/lib/reactions.ts` (tiny `addReaction(postId, kind)` helper using supabase)

**Edited**
- `src/components/PostFeed.tsx` — double-tap handler + PawBurst overlay + comment bounce
- `src/components/social/ReactionBar.tsx` — pop animation, counter slide, haptic
- `src/components/social/SaveButton.tsx` — bookmark pop + sparkle, haptic
- `src/components/social/FollowButton.tsx` — animated state swap
- `src/components/BottomNav.tsx` — active tab bounce, haptic
- `tailwind.config.ts` — new keyframes

## Out of scope (mention only)

- Story viewer animations, message "sent" animations, page transitions — happy to do in a follow-up pass if you want; this PR keeps focus on the feed where the double-tap moment lives.

## Verification checklist

1. Double-tap any post image on mobile viewport → big paw burst plays, "love" reaction count increments by 1, haptic fires.
2. Double-tap again when already reacted → animation plays, count does NOT change.
3. Single tap on image → nothing happens.
4. Pick a reaction from the popover → emoji pops, count slides.
5. Save a post → bookmark fills with pop + sparkle.
6. Follow a user → label crossfades to "Following" with check icon.
7. Switch bottom nav tabs → active icon lifts with subtle bounce.

Approve and I'll ship the whole pass in one go.