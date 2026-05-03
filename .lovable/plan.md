# Pet Journey: Pre-Purchase Guide + Post-Purchase Care Plan

## What I Heard You Say (in plain words)

You're identifying **two huge gaps** that every first-time pet owner in India hits — and your app currently doesn't fully solve either:

### Gap 1 — BEFORE buying ("What should I even get?")
A first-time owner today does this:
- Calls friends → random opinions
- Googles "best dog for India" → 100 conflicting answers
- Visits a breeder/kennel → gets upsold
- Picks emotionally (Husky because it looks cool) → suffers later (Hyderabad heat kills the dog's quality of life)

They have **no clue** about:
- Which breed fits their **city, climate, home size, budget, experience level, purpose** (guard / family / low-maintenance / kids)
- Real **monthly cost** (food + vet + grooming + accessories, not just purchase price)
- **Pure vs mixed breed** — how to spot fake breeders, fake papers
- Breed-specific **temperament warnings** (Rottweiler = needs firm owner, Husky = needs cold + 2hr exercise, Pug = breathing issues, Persian cat = daily grooming, etc.)
- This applies to **all species** — dogs, cats, birds, rabbits, hamsters, fish, turtles

### Gap 2 — AFTER buying ("I have it, now what?!")
Day 1 with a 45-day-old puppy/kitten/bunny — total panic:
- Can I give milk? Cow milk or special? How much?
- Biscuits? Rice? Bones? Sweets? (most owners poison their pets unknowingly)
- When's the **first vaccine**? 6 weeks? 9 weeks? Which one?
- When deworming? Tick prevention? Nail trim? First bath?
- When to neuter/spay?
- House training, crate training, socialization windows
- Red flags — when to rush to the vet vs wait

There's no **chronological, day-by-day, species-and-breed-specific care plan**. Generic blogs exist, personalised guidance does not.

---

## How This Fits Into Your Existing App

Your current tabs: **Home (social) · Mates (mating/adopt/buy) · Health (tracking) · Discovery · Profile**

The new system spreads across them, no new tab needed:

```text
┌─ DISCOVERY tab ──────────────┐    ┌─ MATES tab ─────────────┐
│  + "Find My Pet" Quiz        │───▶│  Filtered breed/adopt   │
│  + Breed Encyclopedia        │    │  listings (existing)    │
│  + Cost Calculator           │    └─────────────────────────┘
└──────────────────────────────┘                │
                                                ▼ (after acquiring)
┌─ HEALTH tab ─────────────────┐    ┌─ HOME tab ──────────────┐
│  + "Care Plan" timeline      │◀───│  Daily Coach Card       │
│  + Age-stage feeding guide   │    │  "Today: Bruno needs    │
│  + Vaccine/dewormer schedule │    │   deworming + 30min     │
│  + Red-flag symptom checker  │    │   socialisation walk"   │
└──────────────────────────────┘    └─────────────────────────┘
                  ▲
                  │ AI Vet chat (already exists) ties it all together
```

---

## The Two New Modules

### MODULE 1 — "Find My Pet" (Pre-Purchase Guide)
**Lives in:** Discovery tab → new top card "Not sure what to get? Take the 2-min quiz"

**Quiz questions** (adaptive, ~10 questions):
1. City / climate (auto-detect)
2. Home type — apartment / independent / farmhouse
3. Family — kids? elderly? other pets?
4. Experience level — first-timer / had pets before
5. Daily time available — <1hr / 1–3hr / 3hr+
6. Monthly budget — ₹2k / ₹5k / ₹10k / ₹20k+
7. Purpose — companion / guard / low-maintenance / kids' pet / show
8. Allergy concerns
9. Noise tolerance
10. Travel frequency

**Output screen** — three sections:
- ✅ **Best matches** (3 breeds across species) with match-score, why it fits, monthly cost estimate, lifespan, energy bar
- ⚠️ **Avoid for you** (e.g. "Husky — Hyderabad summers reach 42°C, this breed suffers above 25°C")
- 📋 **Owner readiness checklist** — "Before you buy: vet identified, ₹15k starter budget, crate, time off work for first 2 weeks…"

**Breed Encyclopedia** (linked from quiz + standalone):
For each breed across **dogs, cats, birds, rabbits, small pets**:
- Origin, temperament, climate fit (India-specific)
- Monthly cost band
- Common health issues
- Pure-breed identifier traits + photos
- "How to spot a fake breeder" checklist
- Buy ethically vs adopt option (links to your Mates/Adopt listings)

### MODULE 2 — "Care Plan" (Post-Purchase Journey)
**Lives in:** Health tab → top section becomes a **timeline** for each pet

When user adds a pet (existing FirstPetWizard already captures species, breed, DOB, weight), we auto-generate a **day-by-day plan** based on age:

```text
Bruno · Labrador · 8 weeks old
─────────────────────────────────
TODAY        Feed: 4× meals puppy-formula, 30g each
             Skip: cow milk, biscuits, sweets, bones
             Activity: 5min play, no outdoor walks yet
             
TOMORROW     Start nail-check routine

DAY 4        💉 DHPPi vaccine due — book vet
DAY 12       Deworming dose 2
WEEK 12      Anti-rabies vaccine
MONTH 4      Switch to 3 meals/day, intro raw veg
MONTH 6      Spay/neuter discussion
MONTH 7      Adult food transition
YEAR 1       Annual booster + dental check
```

**Each day card includes:**
- ✅ What to feed (quantity, brand options across price tiers)
- ❌ What to NEVER feed today (chocolate, onion, grapes, milk after 8 weeks…)
- 🏃 Activity / training focus (socialisation window 8–16 weeks is critical!)
- 🚨 Red flags — "If you see vomiting + lethargy → vet NOW" → one tap to AskVet
- 📚 Mini-lesson — 60-second read ("Why no milk after weaning")

**Different curriculum for:** dog, cat, rabbit, bird, hamster, turtle, fish (each species has its own lifecycle template).

**Already exists in your app and we reuse:**
- `seed_pet_vaccine_reminders` RPC ✅
- AskVet AI ✅
- Notifications system ✅
- `pets` table with species/breed/DOB ✅

**What we add:**
- New `care_plan_templates` table (species + breed → ordered list of milestones)
- New `pet_care_plan_items` table (per-pet generated timeline)
- "Today" widget on Home for the daily nudge
- Edge function `generate-care-plan` — uses Lovable AI to personalise the template to the specific pet (breed, weight, climate, owner experience)

---

## Where Money Comes In (Monetization Gaps)

Your app already has Plus/subscription. New revenue hooks this unlocks:

| Hook | How |
|---|---|
| **Premium Breed Report** | Free quiz shows top match; ₹49 unlocks full PDF with vet-reviewed cost breakdown, India-specific care, 50 photos |
| **Verified Breeder badge** | Breeders pay to be in the "Best matches" results with ✓ badge |
| **Starter Kit affiliate** | "Bruno's first month" bundle → Shop tab (food + crate + toys), commission |
| **Pro Care Plan** | Free plan = milestones; ₹99/mo Plus = AI-personalised daily coach + unlimited AskVet |
| **Vet partnership** | Each scheduled vaccine card has "Book at partner clinic — ₹100 off" → revenue share |
| **Insurance lead-gen** | Care plan surfaces "Insure Bruno for ₹X/mo" at month 2 — partner commission |

---

## User Journey End-to-End

```text
NEW USER (no pet yet)
  │
  ▼
Welcome → "Do you already have a pet?"
  │                              │
  No                             Yes
  │                              │
  ▼                              ▼
Discovery > Find My Pet     FirstPetWizard (exists)
quiz → results              → Care Plan auto-generates
  │                              │
  ▼                              ▼
Browse Mates/Adopt          Home shows "Today's tasks"
matching breed              Health shows full timeline
  │                              │
  ▼                              ▼
Acquire pet → wizard        Daily nudges, vet bookings,
  → Care Plan starts        shop reorders, AI Q&A
```

---

## Technical Plan (for the build phase)

**New DB tables (migration):**
- `breed_profiles` — species, breed, climate_fit, temperament, monthly_cost_min/max, exercise_hrs, experience_level, common_issues[], pure_breed_traits, image_url
- `breed_quiz_responses` — user_id, answers (jsonb), recommended_breeds[]
- `care_plan_templates` — species, life_stage_weeks, action_type (feed/vaccine/training/grooming), title, body, red_flags
- `pet_care_plan_items` — pet_id, due_date, status, template_id, ai_personalised_note

**New pages/components:**
- `src/pages/discover/FindMyPet.tsx` — quiz flow
- `src/pages/discover/BreedEncyclopedia.tsx` + `BreedDetail.tsx`
- `src/components/care/CarePlanTimeline.tsx` — Health tab integration
- `src/components/home/TodayCareCard.tsx` — Home tab daily nudge
- `src/pages/CostCalculator.tsx`

**New edge functions:**
- `generate-care-plan` — Lovable AI (gemini-3-flash-preview) personalises template for the pet
- `breed-recommend` — runs quiz logic + AI to rank breeds

**Reuse:** existing FirstPetWizard, AskVet, notifications, `seed_pet_vaccine_reminders`, Shop, Mates listings.

**Content seed:** Pre-load ~80 dog breeds, 30 cat breeds, 20 birds, 15 rabbits, 10 small-pet profiles tuned for Indian climate. We can generate the first draft with Lovable AI then you review.

---

## Phased Rollout (recommended)

1. **Phase 1 (MVP, ~1 build session):** Find My Pet quiz + breed encyclopedia (dogs only) + basic care plan template (dog 0–6 months)
2. **Phase 2:** Extend to cats + rabbits + birds; add cost calculator; Today card on Home
3. **Phase 3:** AI-personalised daily coach; vet booking integrations; affiliate Shop bundles; Premium PDF

---

## Questions Before I Build

1. Should the quiz be **required for new users without a pet**, or just an optional Discovery card?
2. For Phase 1, do you want to launch with **dogs only** (faster, deeper) or **all species shallow**?
3. Do you want me to **draft the breed content with Lovable AI** for you to review, or will you supply it?
4. Should Care Plan be **free for everyone** (drives retention) or **gated behind Plus** from day 1 (drives revenue)?

Reply with answers (or just "go phase 1, dogs, AI draft, free") and I'll start building.
