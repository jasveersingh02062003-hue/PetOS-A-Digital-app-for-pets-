# Pet Parent Onboarding — Real, End-to-End Rebuild

Scope: **only the pet-parent path** of `/onboarding`. Other roles (buyer, provider, breeder, vet, org) untouched. Every field collected here must show up in a real surface of the app — never just sit in the database.

---

## 1. Audit — What Exists vs. What's Missing

| Step in your spec | Today | Status |
|---|---|---|
| 0. Account type | `Onboarding.tsx` stage `role` (10 cards) | Exists, keep |
| 1. About You (name, @handle, city, photo) | `IdentityStep.tsx` — name, handle (live check), city + geolocate, language, units. **No avatar.** City is *checked* but city auto-fill uses Nominatim already | Partial |
| 2. Add first pet | `Onboarding.tsx` parent stage — name, species, breed (dropdown only, **no "Other"**), DOB only (**no approx age**), gender, photo | Partial |
| Vet contact, reminders opt-in, temperament/allergies/conditions in onboarding | **Missing** (exists in `settings/EmergencyVet`, `PetEditor`, `notif_prefs` but never asked at signup) | Missing |
| 3. Add another pet | `AddAnotherPet.tsx` exists | Keep |
| 4. Goals | `settings/Goals.tsx` exists, **but onboarding never asks goals** | Missing in flow |
| 5. Done | `Done.tsx` — generic, no summary, no confetti | Weak |

**DB columns already present (no migration needed for most):**
- `profiles`: `full_name, handle, city, lat, lng, avatar_url, goals[], emergency_vet jsonb, notif_prefs jsonb, first_time_parent, onboarded`
- `pets`: `name, species, breed, date_of_birth, gender, weight_kg, neutered, microchip_id, temperament[], allergies[], conditions[], avatar_url, primary_vet_id, health_setup_complete`

**Small additions needed:**
- `pets.approx_age_months int` (when DOB unknown) — derive a synthetic DOB on save so the rest of the app keeps working.
- `profiles.reminder_prefs jsonb` (default `{vaccines:true, deworming:true, flea_tick:true, checkup:true}`) — separate from notif transport.

---

## 2. New Pet Parent Flow (6 steps)

```text
[0 Account type] -> [1 About You] -> [2 First Pet] -> [3 Another?]
                                                       |        |
                                                       v        v
                                              loop to [2]    [4 Goals] -> [5 Done]
```

All steps live inside `/onboarding` (single URL, stage param) — keeps resume-on-refresh working.

### Step 0 — Account Type *(unchanged)*
Use existing role cards. Pet-parent advances to step 1.

### Step 1 — About You *(extend `IdentityStep`)*
Add to existing form:
- **Avatar uploader** (circle, optional) → uploads to `avatars` storage bucket → `profiles.avatar_url` + thumbnail variants (image-process edge fn already exists).
- City stays required, "Use my location" already wired.
- Keep handle live availability + language + units.
- Save in one upsert. Advance to step 2.

### Step 2 — First Pet *(replace inline parent wizard with new `FirstPetWizard.tsx`)*
Single scrollable form, 4 collapsible sections, sticky bottom CTA.

**Section A — Basics**
- Pet photo (large square, optional) → `pet-avatars` bucket
- Name *(required)*
- Species (segmented: Dog/Cat/Bird/Rabbit/Other)
- Breed: searchable dropdown from `BREEDS[species]` **+ "Other" → free-text** (saves the typed value)
- Sex (Male/Female)
- Age input with toggle:
  - DOB (date picker), **or**
  - Approx age (Years + Months number inputs) → stored in `approx_age_months`, server-side trigger fills `date_of_birth` = `today - approx_age_months`

**Section B — Physical & Health (optional but visible)**
- Weight (kg/lb based on `units`)
- Spayed/Neutered (Yes/No/Unknown)
- Microchip ID
- **Emergency vet name + phone** → `profiles.emergency_vet = {name, phone}`

**Section C — Behaviour**
- Temperament chips (multi) → `pets.temperament[]`
- Allergies chips → `pets.allergies[]`
- Conditions chips → `pets.conditions[]`
- If user touches any chip, set `health_setup_complete = true` so the Health-tab nag card hides.

**Section D — Reminders**
- Master toggle "Send me care reminders" (default on)
- Multi-chip: Vaccines / Deworming / Flea & tick / Annual check-up
- Channel: Push (default) / Email — writes `profiles.notif_prefs` and `profiles.reminder_prefs`
- On submit, if vaccines toggled, insert seed rows into `vaccination_reminders` (table already used by `vaccination-reminders` edge fn) keyed to `date_of_birth + species default schedule`.

CTA "Add pet & continue" → inserts `pets` row, fires reminder seeding, goes to Step 3.

### Step 3 — Add Another? *(keep `AddAnotherPet.tsx`)*
"Yes" → loop to Step 2 (reuse `FirstPetWizard` in "additional" mode — hides reminders & vet sections since already set).
"No" → Step 4.

### Step 4 — Goals *(new `GoalsStep.tsx` inside onboarding)*
- Reuse `GOALS` from `lib/breeds.ts` and `ChipGroup` component.
- Live preview panel below: as user picks goals, list features ("Vet & AI help → AskVet on Home", "Walking → Services tab pinned", etc.).
- Saves `profiles.goals[]` and `profiles.onboarded = true`.
- This array is **already read** by `PetParentHome.tsx` for module ordering — confirm and wire any missing modules.

### Step 5 — Done *(rewrite `Done.tsx` for parents)*
- Confetti (canvas-confetti, 1.5s, single fire)
- Big "You're all set, {firstName}!"
- Summary card pulled live from DB:
  - `{n} pets added`
  - `Reminders: On / Off`
  - `Goals: {n} selected`
- Primary CTA "Open my home" → `/`. FirstRunGate already lets them through.

---

## 3. Where Each Field Surfaces in the App (real wiring)

| Collected | Surface |
|---|---|
| `profiles.avatar_url` | Top-bar avatar, comments, `UserProfile`, mate cards |
| `profiles.city + lat/lng` | Discover, Mates, Services nearby (`useUserLocation`) |
| `profiles.handle` | Public URL `petos.app/@handle`, share cards |
| `profiles.emergency_vet` | Health tab → Emergency card; AskVet triage CTA |
| `profiles.goals[]` | `PetParentHome` module ordering, Discover tabs default |
| `profiles.notif_prefs + reminder_prefs` | `vaccination-reminders` & `pet-care-reminders` edge fns; Settings → Notifications |
| `pets.avatar_url` | Pet card, Home greeting, MissingFeed prefill |
| `pets.temperament/allergies/conditions` | Health tab, Mates filters, AskVet context, AI suggestions |
| `pets.weight_kg` | Health charts, dose calculators |
| `pets.microchip_id` | MissingFeed auto-fill |
| `pets.date_of_birth` (or derived) | Age in greetings, vaccine schedule, life-stage feed |
| `pets.health_setup_complete` | Hides Home + Health nag cards |
| `vaccination_reminders` rows | Push notifications via `send-push` |

---

## 4. Implementation Plan (priority-ordered, no overlap)

**P0 — Data foundation**
1. Migration: add `pets.approx_age_months int`, `profiles.reminder_prefs jsonb default '{...}'`. Add trigger to derive DOB from `approx_age_months` on insert/update if DOB null.
2. Confirm `vaccination_reminders` table shape; add seed helper SQL function `seed_pet_vaccine_reminders(pet_id uuid)`.

**P1 — Components**
3. Extend `IdentityStep.tsx`: avatar uploader (uses existing `uploadImage` lib + `avatars` bucket).
4. New `src/components/onboarding/FirstPetWizard.tsx` (replaces inline parent stage in `Onboarding.tsx`). Sections A–D, validation, submit handler.
5. New `src/components/onboarding/GoalsStep.tsx` with live preview map.
6. Rewrite `src/pages/onboarding/Done.tsx` for pet-parent: confetti + live summary card; keep current behaviour for other roles.

**P2 — Wiring**
7. `Onboarding.tsx`: replace `parentStep 0/1` block with `<FirstPetWizard />`; add `goals` stage between `add-another` and `done` for pet-parent only.
8. `Onboarding.tsx` parent submit: call `seed_pet_vaccine_reminders` RPC when reminders enabled.
9. Verify `PetParentHome` reads `goals[]` and reorders modules; fill any gap.
10. Update `FirstRunGate` / `PostAuth` — no logic change needed (gate already requires `full_name + handle + onboarded + ≥1 pet`).

**P3 — Polish**
11. Progress bar `WizardSteps` updated to 6 dots for parent path: Account · About You · Pet · More? · Goals · Done.
12. Fade transitions (0.2s) between stages with `framer-motion` (already a dep? if not, simple CSS).
13. Confetti on Done (`canvas-confetti`).
14. QA: full flow signed-out → signup → 6 steps → Home shows pet, reminders scheduled, goals reflected.

---

## 5. Files Touched

**New**
- `src/components/onboarding/FirstPetWizard.tsx`
- `src/components/onboarding/GoalsStep.tsx`
- `supabase/migrations/<ts>_pet_parent_onboarding.sql`

**Modified**
- `src/components/onboarding/IdentityStep.tsx` (add avatar)
- `src/components/onboarding/WizardSteps.tsx` (parent variant w/ 6 steps)
- `src/pages/Onboarding.tsx` (stage router: insert `goals`, swap parent wizard)
- `src/pages/onboarding/Done.tsx` (parent summary + confetti)
- `src/pages/onboarding/AddAnotherPet.tsx` (route "No" → `?stage=goals` instead of `done`)
- `src/lib/breeds.ts` (extend lists slightly + ensure "Other" sentinel)

**Untouched** (out of scope per your instruction)
- Buyer / Provider / Vet / Breeder / Org flows
- Auth pages, FirstRunGate logic, PostAuth routing

---

## 6. Acceptance Checks

After implementation, a brand-new email signup must be able to:
1. Sign up → land on `/onboarding`.
2. Complete About You with avatar → see avatar in top bar.
3. Add a pet with approx age + temperament + reminders on → pet shows on Home with correct age, vaccine reminder appears in Notifications within seconds.
4. Loop "Add another" works.
5. Pick 3 goals → Done summary says "1 pet · Reminders: On · Goals: 3" → Home modules reordered to match goals.
6. Refresh mid-flow → resumes at the same stage.
7. Re-login → goes straight to Home (never re-prompted).

Ready to switch to build mode and implement P0 → P3 in order?