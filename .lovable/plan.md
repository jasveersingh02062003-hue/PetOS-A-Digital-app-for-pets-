# First-Launch Experience — Splash, Feature Showcase, AI Coach

A polished first impression for new users: animated logo splash → swipeable feature showcase → "Get started" → existing onboarding (now with an AI coach assistant that explains why each step matters).

## What the user sees

### 1. Splash screen (Netflix-style logo reveal) — every cold start
- Full-screen, brand background (cream / Petos primary)
- Animated **Petos** wordmark — letters fade-and-rise in sequence (~1.2s), then a soft pulse of the paw mark
- Tagline fades in below: *"A complete digital life for every pet"*
- Auto-dismisses after 1.6s OR on tap
- Shown on every cold start (not on every navigation), gated by `sessionStorage` so it doesn't replay during the same session
- `prefers-reduced-motion` honoured — falls back to a static logo + 600ms fade

### 2. Feature showcase carousel — first launch only
- Triggers only when `localStorage.petos_seen_intro` is missing
- 5 swipeable, full-screen cards with framer-motion enter animations:
  1. **Your pet's whole life, in one app** — feed + vault icon montage
  2. **Petos AI** — "Ask anything about your pet, anytime" (chat bubble animation)
  3. **Health vault & vaccination reminders** — auto-reminders 5 days before due
  4. **Find a mate, a vet, or a sitter** — three-icon split
  5. **If they go missing, the city helps** — pulsing map pin
- Each card: large illustration/icon, headline, one-line copy, dot indicators
- Bottom: **Skip** (top-right) and **Get started** (final card) → routes to `/auth`
- Sets `localStorage.petos_seen_intro = "1"` on completion or skip

### 3. AI Coach in onboarding — first onboarding only
- A small, friendly toast-card that slides in from the top-right of `Onboarding.tsx`, contextual to the current step
- Each step has a 1-2 sentence "why this matters" message, e.g.:
  - Step 1 (About you): *"I use your city to find nearby vets and your language to reply in your tongue."*
  - Step 3 (Body & lifestyle): *"Weight + diet lets me catch unsafe food recommendations before you see them."*
  - Step 6 (Safety): *"A vaccination certificate unlocks the verified badge and mating discoverability."*
- Card has a small AI sparkle icon, "Petos AI" label, and a dismiss × that hides it for the current step only
- Auto-shows for ~6 seconds on first arrival to each step, then collapses to a small floating "?" pill the user can re-open
- Honours `prefers-reduced-motion`

## Routing flow

```
Cold start
  ↓
Splash (1.6s) — every session
  ↓
First-time user? ─yes→ /welcome (showcase) → /auth → /onboarding (with coach)
  ↓ no
Existing route (Home / Auth / etc.)
```

## Files to create

- `src/components/Splash.tsx` — animated logo reveal, sessionStorage gate
- `src/components/PetosLogo.tsx` — reusable SVG wordmark + paw mark
- `src/pages/Welcome.tsx` — feature showcase carousel
- `src/components/welcome/FeatureSlide.tsx` — individual showcase card
- `src/components/onboarding/AiCoach.tsx` — contextual AI helper

## Files to edit

- `src/App.tsx` — wrap routes in `<Splash>`; redirect first-time users from `/` to `/welcome`; add `/welcome` route
- `src/pages/Onboarding.tsx` — mount `<AiCoach step={step} />` overlay
- `src/index.css` — add 3 keyframes: `letter-rise`, `paw-pulse`, `coach-slide-in` (only if not already covered by the existing animations)

## Technical notes

- Use **framer-motion** (already a dep — used in Onboarding.tsx) for orchestrated sequences
- Splash uses a single `AnimatePresence` with staggered children for the wordmark
- Showcase uses `embla-carousel-react` if already installed, otherwise a lightweight `useState` + framer-motion swipe handler (simpler, no new dep)
- Coach copy lives in a `STEP_COACH_MESSAGES` const inside `AiCoach.tsx` — easy to tune later
- All new copy is calm, mobile-first (393px), no scammy phrasing — matches existing brand laws

## What is NOT in this plan

- No backend / DB changes
- No new edge functions
- No video assets — pure CSS/SVG/framer-motion (keeps bundle small, instant load)
- No re-skin of existing onboarding steps — only the coach overlay is added

Reply "yes" to ship.