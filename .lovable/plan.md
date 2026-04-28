## Goal

Stop wasting the bottom-nav center slot on a generic "+" button. Move to a flat 5-tab layout that mirrors the user's mental model (Home · Mates · Health · Discover · Profile) and replace the global FAB with a per-tab contextual FAB that means something different on each screen.

## New navigation

```text
┌──────────────────────────────────────────────────┐
│  Home    Mates    Health    Discover    Profile  │
│  (post)  (heart)  (cross)   (compass)   (user)   │
└──────────────────────────────────────────────────┘
   social   mating   health    explore    me
```

- Flat 5-tab bar — no center cutout, no global FAB.
- Active tab = primary color; Mates active = coral (kept).
- Emergency Siren button stays where it is (top-right of nav, already implemented).

## Per-tab contextual FAB

A single floating "+" button rendered by `AppShell`, but its icon + action change based on the active route:

| Route | FAB icon | Action |
|---|---|---|
| `/` (Home) | Plus | Open post composer (existing `petos:open-composer` event) |
| `/mates` | Heart+ | Navigate to `/mates/new` (new mating listing) |
| `/health` | Activity+ | Open quick health-log sheet (weight / vaccine / symptom) |
| `/discover` | none | Hidden — Discover is browse-only |
| `/profile` | none | Hidden — settings live in header |

Long-press on any FAB still opens the Emergency sheet (preserves the existing gesture).

## Files to change

1. **`src/components/BottomNav.tsx`** — replace the 5-cell grid (which has a center cutout) with a flat 5-tab grid. Tabs: Home, Mates, Health, Discover, Profile. Remove the center FAB block. Keep the Siren emergency button as-is.

2. **`src/components/AppShell.tsx`** — render a new `<ContextualFab />` component instead of the current global `<ComposerButton variant="global" />`. Keep the EmergencySheet wiring.

3. **`src/components/ContextualFab.tsx`** (new) — reads `useLocation()`, picks the right icon + action from a small route map, renders a floating button bottom-right above the nav (like Gmail). Long-press → emergency. Hidden on `/discover`, `/profile`, `/auth`, `/onboarding`, `/admin*`, `/ai`.

4. **`src/components/health/QuickLogSheet.tsx`** (new, small) — bottom sheet with three buttons: "Log weight", "Log vaccine", "Log symptom" → routes to existing health flows. Triggered by the Health FAB.

5. **`src/components/Composer.tsx`** — keep `ComposerButton` as a component but stop rendering the global variant from `AppShell`. The composer sheet itself stays untouched (still opened by the `petos:open-composer` event from Home FAB and from EmptyState CTAs).

6. **`src/components/QuickAccessRail.tsx`** — remove the "Mates" chip (now a tab) and "Ask vet" stays. Add a "Mating" chip only if user feedback shows it's missed; otherwise leave the 6 items reduced to 5.

## Behavior details

- **No route changes.** `/`, `/mates`, `/health`, `/discover`, `/profile` already exist in `App.tsx` (lines 198–203). Health is currently only reachable via PetHeroCard — promoting it to a tab just exposes it.
- **Deep links unchanged.** Nothing breaks externally.
- **Animation.** Active tab keeps the existing spring scale + translate animation. FAB fades/slides in when route changes (framer-motion `AnimatePresence`).
- **Safe area.** FAB positioned with `bottom: calc(5.5rem + env(safe-area-inset-bottom))` so it sits above the nav, mirroring the Siren button.
- **Accessibility.** FAB `aria-label` updates per route ("New post", "New mating listing", "Log health entry"). Long-press hint added to `aria-description`.

## What we are NOT doing (yet)

- Not splitting Discover into Explore/Shop/Meetups sub-tabs — that's a separate redesign.
- Not moving Mating content out of the existing `/mates` page — the page already handles listings, nearby, history.
- Not changing Health page IA — only adding the quick-log sheet entry point.
- Not removing the Emergency Siren button.

## Acceptance check

1. Bottom nav shows 5 evenly-spaced tabs, no center cutout.
2. Tapping Health tab navigates to `/health` (no longer requires PetHeroCard).
3. On Home, FAB "+" opens the post composer.
4. On Mates, FAB navigates to `/mates/new`.
5. On Health, FAB opens the quick-log sheet.
6. On Discover and Profile, no FAB is visible.
7. Long-press on any visible FAB opens the Emergency sheet.
8. Siren button stays top-right of the nav on all tabs.
