# Petos Social — Premium Redesign Plan

## Honest critique of what's live now (your screenshots)

Looking at the `pubg` post card and the home screen:

1. **It reads as a stock IG card.** Square photo, avatar-name-time header, icon row beneath. The "Pet-first" header is there in code, but visually the pet identity is the same weight as any IG username — no signature treatment.
2. **The trust strip is weak.** "Unverified · Golden Retriever · 7y · hyderabad" is rendered as four flat grey/orange chips. It looks like a filter bar, not a credibility belt. Nothing about it says *"this is data Instagram literally cannot show you."*
3. **The action bar is generic.** A row of 5 monochrome icons with a tiny "Top ❤️ 2 🐾 1" line above. No personality, no pet language, no premium feel.
4. **No spatial hierarchy.** Header, image, chips, caption, actions are all the same card width, same padding, same neutral background. Nothing pulls the eye. Premium apps (IG Reels, TikTok, LinkedIn premium cards) always have **one hero element** per card.
5. **Home screen is busy but not energetic.** Pet card → SOS banner → composer → 6-icon grid → tabs → feed. Five competing surfaces above the fold, none of them feel like *the* moment.

Rating today: **6.2 / 10.** Functional, organized, but indistinguishable from any pet-themed Instagram clone.

---

## The USP — one sentence

> **"Every post is a Pet Passport entry."** The pet — not the owner — is the protagonist, and every card is provably backed by health, lineage, and locality data that no other social app has.

Three pillars derived from this:

1. **Pet-as-protagonist** — the pet's face, name, and life stats own the card.
2. **Receipts, not vibes** — verified vaccines, breed lineage, vet co-signs, walk streaks, rescue journeys appear as first-class card chrome.
3. **Pet-native interactions** — boops, treats, tail-wags, vet co-signs replace generic likes. They sound, feel, and animate differently.

---

## Phase A — The "Pet Card" redesign (frontend only, highest leverage)

The single biggest change. Transforms the card from "IG post with a pet badge" into "a moment from a pet's life."

```text
┌──────────────────────────────────────────────┐
│  ╭─────╮                                      │
│  │ pet │  PUBG                          ◐ ⋯  │
│  │ avtr│  Golden Retriever · 7y               │
│  ╰─────╯  ✓ Vaccinated  📍 Hyderabad          │
│           by @jpmorgan · 22h                  │
├──────────────────────────────────────────────┤
│                                              │
│           [ EDGE-TO-EDGE PHOTO ]             │
│                                              │
│   ╭───────────────────────────────╮          │
│   │ "meet pubg"                   │  ← caption overlay
│   ╰───────────────────────────────╯          │
├──────────────────────────────────────────────┤
│  🐾 boop · 🦴 treat · 💛 love     12 paws    │
│  💬 4    🔖    ↗                              │
└──────────────────────────────────────────────┘
```

Concrete changes:

- **Header collapses trust into the identity block.** Vaccinated/city move *up* next to breed-age, so the first glance reads "PUBG, Golden Retriever, 7y, vaccinated, Hyderabad." Removes the redundant chip strip below the photo.
- **Edge-to-edge media.** Image fills card width, no inner padding. Adds a soft bottom gradient with the caption laid over the last 80px of the photo (LinkedIn premium / Apple News pattern). Optional — when caption is long, it falls under the photo as today.
- **Reaction summary becomes the headline below the photo.** Big emojis, single "12 paws" tally on the right (not a Top-3 row). Tap the row to open a reaction sheet showing who booped.
- **Action row gets generous spacing** (48px tap targets), the comment count moves inside the icon (`💬 4`), and the bookmark/share/report sit right-aligned with a divider.
- **Owner sub-line is intentionally smaller** ("by @jpmorgan · 22h"), reinforcing the pet is the subject.
- **Follow button** moves out of the card to a hover/long-press action — one less competing CTA per scroll.

Files: `PetPostHeader.tsx`, `PostFeed.tsx` (PostCard JSX), `PostActionBar.tsx`, `PostTrustStrip.tsx` (will be merged into header for typical posts; kept only for org/non-pet posts).

---

## Phase B — Signature reactions (frontend + tiny backend)

Pet-native reactions exist but feel like emojis on buttons. Make them a **signature interaction**.

- **Long-press the boop button → radial picker** with 6 reactions in a fan, IG-Reels style, with subtle haptic + a paw-print ripple under the finger.
- **Each reaction has its own micro-animation** when tapped: boop = paw print drops, treat = bone bounces, love = hearts float, strong = flex pulse.
- **Reaction counts shown as stacked emoji + total** (`🐾🦴💛 +12`) instead of a comma row.
- **Backend:** add a tiny `reactions_summary` view (or extend the existing trigger) so the top-3 emojis are computed in SQL, not on the client. One query, one render.

Files: `ReactionBar.tsx`, new `ReactionPicker.tsx`, new SQL view `post_reactions_top`.

---

## Phase C — Hero variants by post `kind` (uses backend already shipped)

The `kind` column (`moment | milestone | memorial | tribe_post`) is already on `posts` — but visually every card looks identical. Make each kind a distinct hero treatment:

- **Milestone** (birthday, 1st walk, gotcha day): card gets a thin gold top-stroke, the photo has a confetti animation on first appear, header shows a "🎂 Birthday" ribbon.
- **Memorial**: warm sepia tone overlay on the photo, soft amber border, "💛 In memory" ribbon, reactions replaced with single "🕯 light a candle" tap (counts as a reaction kind).
- **Tribe post** (group): card shows the tribe badge + "Posted in 🐕 Hyderabad Goldens" pill, tap → group page.
- **Default moment**: the standard pet card from Phase A.

This alone makes the feed feel **alive and varied** — not a wall of identical squares.

Files: `PostKindBadge.tsx` (exists, expand), `PostFeed.tsx`, new `MemorialCard.tsx` wrapper.

---

## Phase D — Home above-the-fold, simplified

Today there are 5 stacked surfaces before the feed. Cut to **three** with stronger hierarchy:

1. **The Pet hero card** (already exists) — but bigger pet avatar (96px), age in big numerals, single primary CTA changes by context (verify vaccines today; share moment if vaccines are done).
2. **Smart Story Rail** — keep, but the "Add" tile becomes a soft pulsing prompt only if I haven't posted in 24h. Otherwise it's just my latest story with a green "Live" dot.
3. **Quick-actions strip** condensed from 6 icons to **3 contextual** ones based on time of day + pet state (morning → Walks; mealtime → Shop; rash detected → Ask vet). The other actions move into a "More" sheet.

The SOS banner is collapsed into a single floating red dot bottom-right (already there), so it isn't competing for the hero spot.

Files: `PetParentHome.tsx`, `SmartStoryPrompt.tsx`, new `QuickActions.tsx`.

---

## Phase E — Premium feel polish (cross-cutting)

Small details that separate "clone" from "premium":

- **Display font on pet names** (Fraunces/Playfair already in `font-display`) — use it for the pet name in cards. Sets the brand voice.
- **Card radius up to `rounded-3xl`** with a `shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]` — looks lifted, not boxed.
- **Tap microinteractions** on every card surface: scale to 0.99 on press, springs back. Already have `haptic()` — wire it to all primary actions (boop, save, share).
- **Skeleton → content fade** instead of pop-in (200ms opacity).
- **Verified vaccinated chip** uses a custom SVG paw-shield, not the generic `ShieldCheck` lucide icon.

Files: `index.css` (shadow tokens), `tailwind.config.ts`, all card components.

---

## Phase F — Backend alignment (ensures the visuals are real, not faked)

Frontend redesign without backend backing = lipstick. Three small additions:

1. **`post_reactions_top` SQL view** — returns top 3 reaction kinds + total per post. Powers the reaction summary line in O(1).
2. **`pet_snapshot` extension** — add `lifetime_walks_km`, `streak_days`, `lineage_verified` to the JSON. Trigger already exists; just extend the SELECT.
3. **`posts.hero_variant` derived column** — small PL/pgSQL function that sets `hero_variant` based on `kind` + pet age + time since last post (e.g., "first post in 30 days" auto-promotes to `comeback` variant). Lets the feed stay visually surprising without manual tagging.

Migration: one new view + one ALTER TABLE + one trigger update. Backwards compatible (all nullable).

---

## Order of execution

| # | Phase | Visual impact | Effort |
|---|-------|--------------:|-------:|
| 1 | A — Pet Card redesign | very high | M |
| 2 | C — Hero variants by kind | high | M |
| 3 | B — Signature reactions | high | M |
| 4 | E — Premium polish | medium | S |
| 5 | D — Home simplification | medium | S |
| 6 | F — Backend view + snapshot fields | low (enables 1–3) | S |

I'll do **F first as a tiny migration** (so visuals have data), then **A → C → B → E → D** in one continuous build.

---

## What I will NOT change

- Auth, routing, role dashboards, payments — out of scope.
- Story viewer internals, comment sheet — only restyled if they obviously clash with the new card.
- Existing `kind` / `pet_snapshot` schema — only **extended**, never broken.

---

## Acceptance check (how we'll know it worked)

- Show the `pubg` post next to an Instagram post side-by-side — it should be **immediately distinguishable** without reading text.
- Tapping a reaction triggers a different micro-animation per kind.
- A milestone post and a moment post look visually different at a glance.
- Home above-the-fold has at most 3 surfaces, not 5.
- Lighthouse mobile score doesn't regress.

Approve and I'll start with the Phase F migration, then ship Phases A → E in one pass.