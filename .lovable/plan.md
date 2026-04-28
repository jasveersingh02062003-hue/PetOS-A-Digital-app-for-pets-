
# Onboarding 2.0 — every answer earns its place

## What's asked today vs. what's missing

**Today (4 steps, ~12 fields):** name, city · pet name, species, breed, DOB, gender, weight, neutered, bio · vaccine cert · interests + discoverable.

**Problems**
- Health, AI vet, services, shop, breeding, social — none of them get the data they really need from onboarding. They show generic content for every user.
- "Interests" is decorative — it changes nothing in the app today.
- No allergies, no diet, no activity level, no temperament, no reproductive history, no emergency vet, no notifications consent, no language, no measurement units.
- No way to revisit answers (no settings screen).
- No emotional pacing — it feels like a Google Form.

---

## The 7 chapters (psychological pacing)

Each chapter is one screen with **one clear question per screen** (no dense forms), a soft Lottie/photo illustration on top, large tap targets, and a one-line "why we ask" caption that explains the impact. Skippable fields are marked. Total time ≈ 90 seconds.

```text
1. Welcome           → emotional hook, 3 swipeable cards
2. About you         → name, city, language, units
3. Meet your pet     → photo, name, species, breed, DOB, gender
4. Body & lifestyle  → weight, neutered, activity, diet, allergies
5. Personality       → temperament tags, social comfort
6. Your goals        → 6 intent chips (drives feed, nav, AI tone)
7. Safety & consent  → vaccination upload, emergency vet,
                       notifications, mating discoverability
```

After step 7: a celebratory screen with a generated illustrated "pet card" the user can share.

---

## Every question, why it's asked, where it shows up

| # | Question | Why (psychology) | Backend field | Powers in app |
|---|----------|------------------|---------------|---------------|
| 1 | Your full name | Identity, trust | `profiles.full_name` | Greeting, reviews, agreements |
| 2 | City (auto-detect button) | Belonging, locality | `profiles.city` | Discover radius, services, mating filter, shop shipping |
| 3 | Preferred language | Inclusion | `profiles.language` *(new)* | AI vet replies, UI strings (future) |
| 4 | Units (kg / lb, °C / °F) | Comfort | `profiles.units` *(new)* | Weight charts, temperature in symptom logs |
| 5 | Pet photo | Pride, attachment | `pets.avatar_url` | Posts, mating cards, vet handoff |
| 6 | Pet's name | Personification | `pets.name` | Everywhere |
| 7 | Species | Core | `pets.species` | AI prompt, breed list, vaccine schedule, food categories in shop |
| 8 | Breed (autocomplete by species) | Specificity | `pets.breed` | Mating eligibility, breed-specific health alerts, AI grounding |
| 9 | Date of birth (or "approx age") | Life-stage care | `pets.date_of_birth` | Vaccine due dates, food portion math, senior health prompts |
| 10 | Gender | Reproductive logic | `pets.gender` | Mating side, hormonal-cycle prompts |
| 11 | Weight | Dosage, dieting | `pets.weight_kg` | AI vet drug refs, portion calc, weight-trend chart |
| 12 | Neutered / Spayed | Health & breeding gate | `pets.neutered` | Hides mating CTA, AI ignores reproductive prompts, behavior tips |
| 13 | Activity level (low / medium / high) | Calorie + service fit | `pets.activity_level` *(new enum)* | Daily portion math, recommended services (walking, daycare) |
| 14 | Diet type (kibble / raw / home / mixed) | Nutrition baseline | `pets.diet_type` *(new enum)* | Shop food filter, nutrition log defaults, AI grounding |
| 15 | Known allergies / intolerances | **Medical safety** | `pets.allergies` *(new text[])* | Red banner in AI replies, shop filter, vet-share PDF |
| 16 | Existing conditions | Continuity of care | `pets.conditions` *(new text[])* | Vet portal pre-fill, AI grounding, vault auto-tag |
| 17 | Temperament tags (calm, playful, anxious, reactive…) | Self-knowledge, breeding match | `pets.temperament` *(new text[])* | Mating compatibility hint, service notes, social filter |
| 18 | Social comfort (alone / pairs / crowds) | Boarding & dog-park fit | `pets.social_level` *(new enum)* | Boarding service warnings, mate listing copy |
| 19 | Goals (multi-select, 6 chips) | Personalisation | `profiles.goals` *(new text[])* | Feed scoring, home shortcuts, nav order, empty-state CTAs |
| 20 | Vaccination certificate | Trust + unlock | `vault_documents` + `pets.vaccination_verified` | Mating gate, verified badge, vet-share |
| 21 | Emergency vet contact | Crisis readiness | `profiles.emergency_vet` *(new jsonb)* | One-tap call from EmergencySheet, AI escalation card |
| 22 | Notifications consent (push, email, SMS) | Respect + retention | `profiles.notif_prefs` *(new jsonb)* | Notification fan-out triggers respect this |
| 23 | Discoverable for mating | Privacy default OFF | `pets.discoverable_for_mating` | Mating grid visibility |

**Step 1 (Welcome)** asks nothing — it's three full-bleed swipe cards with motion, setting tone:
- *"A complete digital life for every pet."*
- *"Your vet, your community, your shop — one home."*
- *"Your pet's privacy stays yours. Always."*

---

## Emotional & visual design

- **One question per screen.** No grids of inputs. Builds momentum (Zeigarnik + completion bias).
- **Progress is segmented (7 dots)**, not a bar — feels shorter.
- **Hero illustration on every step.** Real photos for species selection (dog/cat/bird/rabbit/other) generated once via Lovable AI image and cached in `public/onboarding/`. Lottie-style soft motion (framer-motion `fade-in`, `scale-in`, slide between steps) — already in `tailwind.config.ts`.
- **"Why we ask" microcopy** under every question (1 short line, muted) — turns a form into a conversation and reduces friction.
- **Skippable** for steps 4, 5, 7 fields except vaccine (which is itself optional but gated).
- **Haptic + check animation** on each "Continue."
- **Final screen:** an AI-generated illustrated "Pet Card" (using Gemini image) with the pet's name, species, badges, downloadable + shareable.

---

## Profile → Settings (edit anything, anytime)

New `/settings` page reachable from Profile's gear icon, with grouped sections that map **1-to-1 with onboarding chapters**:

```text
Settings
├── About you            (name, city, language, units, avatar)
├── Notifications        (push / email / SMS toggles per type)
├── Emergency vet        (name, phone, clinic, address)
├── Privacy              (mating discoverability per pet, profile visibility)
├── Pets                 (per-pet editor: photo, body, lifestyle,
│                         personality, conditions, allergies, vaccines)
├── Goals & interests    (re-pick the 6 chips)
├── Account              (email, password, sign out, delete account)
```

Each section uses the exact same components as the onboarding step it mirrors, so the user feels the system is consistent.

---

## Backend changes (one migration)

```sql
-- profiles additions
ALTER TABLE profiles
  ADD COLUMN language text DEFAULT 'en',
  ADD COLUMN units jsonb DEFAULT '{"weight":"kg","temp":"c"}'::jsonb,
  ADD COLUMN goals text[] DEFAULT '{}',
  ADD COLUMN emergency_vet jsonb,
  ADD COLUMN notif_prefs jsonb DEFAULT
    '{"push":true,"email":true,"sms":false}'::jsonb;

-- enums
CREATE TYPE activity_level AS ENUM ('low','medium','high');
CREATE TYPE diet_type      AS ENUM ('kibble','raw','home','mixed','prescription');
CREATE TYPE social_level   AS ENUM ('solo','pairs','crowds');

-- pets additions
ALTER TABLE pets
  ADD COLUMN activity_level activity_level,
  ADD COLUMN diet_type diet_type,
  ADD COLUMN social_level social_level,
  ADD COLUMN allergies text[] DEFAULT '{}',
  ADD COLUMN conditions text[] DEFAULT '{}',
  ADD COLUMN temperament text[] DEFAULT '{}';
```

The `interests` column on `profiles` already exists; we keep it but rename intent in the UI to **Goals**, with 6 fixed chips that the rest of the app reads.

---

## How each answer reaches each surface

- **AI vet (`supabase/functions/chat`)**: system prompt receives `species, breed, age, weight, neutered, allergies, conditions, diet_type, activity_level` so replies are pet-specific and avoid unsafe drug suggestions.
- **EmergencySheet**: shows the saved emergency vet's number as the primary call CTA when present.
- **Discover / Mating grid**: filters by `city`, `species`, `temperament` overlap, hides if `neutered=true` or `discoverable_for_mating=false`.
- **MateListing card**: shows temperament chips + verified badge.
- **Health vault**: auto-tags new uploads against `conditions`; weight chart uses `units.weight`.
- **Shop**: filters food category by `species` + `diet_type`, hides items containing known `allergies`.
- **Services**: surfaces walking/daycare first when `activity_level=high` or `social_level=crowds`.
- **Notifications fan-out**: every `notify_user` insert checks `profiles.notif_prefs` and silently skips channels the user disabled.
- **Home feed**: posts are scored by `goals` overlap + `species` + `city`.

---

## Files

```text
EDIT  src/pages/Onboarding.tsx                    7-step rewrite, framer-motion
NEW   src/pages/Settings.tsx                      hub with sections below
NEW   src/pages/settings/AboutYou.tsx
NEW   src/pages/settings/Notifications.tsx
NEW   src/pages/settings/EmergencyVet.tsx
NEW   src/pages/settings/Privacy.tsx
NEW   src/pages/settings/PetEditor.tsx            per-pet (id param)
NEW   src/pages/settings/Goals.tsx
NEW   src/components/onboarding/StepShell.tsx     hero, progress, nav, motion
NEW   src/components/onboarding/ChipGroup.tsx     reusable chip multi-select
NEW   src/components/onboarding/SpeciesPicker.tsx photo-card grid
NEW   src/components/onboarding/PetCardShare.tsx  final celebration
NEW   src/lib/breeds.ts                           breed list per species
NEW   public/onboarding/{dog,cat,bird,rabbit,other}.webp  (AI-generated once)
EDIT  src/pages/Profile.tsx                       gear → /settings, show pet edit
EDIT  src/App.tsx                                 add /settings/* routes
EDIT  supabase/functions/chat/index.ts            include new pet context
EDIT  src/components/EmergencySheet.tsx           call saved vet first
NEW   supabase/migrations/<ts>_onboarding2.sql    columns + enums above
```

No new paid dependencies. Uses existing `framer-motion`, `tailwindcss-animate`, Lovable AI for the species photos and the final pet-card illustration.

---

## Out of scope (future)
- Multi-language UI (we store the choice now; translations later).
- Sleep / step tracking integrations.
- Behavioral history quiz (>3 questions) — kept short on purpose.

Approve and I'll ship it: migration first, then the 7-step rewrite + Settings hub + AI/Emergency wiring.
