
# Pet Parent Onboarding — Finish the Gaps (Sequential, No Overlap)

After re-auditing the code, **most of the original plan is already shipped**. Only six concrete gaps remain. We'll do them strictly in order, verify each, then walk the full user journey.

---

## Re-Audit (Updated, Accurate)

| Item | Status |
|---|---|
| `pets.approx_age_months`, `profiles.reminder_prefs`, DOB derive trigger | ✅ Live in DB |
| `seed_pet_vaccine_reminders` RPC | ✅ Exists & **already called** from `FirstPetWizard` |
| `FirstPetWizard.tsx` with `isAdditional` mode | ✅ Built |
| `GoalsStep.tsx`, `Done.tsx` (confetti + summary) | ✅ Built |
| `IdentityStep.tsx` avatar uploader | ✅ Built |
| Onboarding stage router incl. `goals` stage | ✅ Wired |
| **`ReactionBar` runtime crash blocking Home** | ❌ Open |
| **"Add another" reuses rich wizard** | ❌ Currently routes to lightweight `add-pet` stub |
| **`WizardSteps` parent‑variant (6 dots)** | ❌ Still generic |
| **`PetParentHome` reorders modules by `goals[]`** | ❌ Reads name only, not `goals` |
| **Stage fade transitions** | ❌ Missing |
| **Manual end-to-end verification** | ❌ Never done |

---

## Sequential Plan (one after the other, no overlap)

### Step 1 — Unblock the preview (fix `ReactionBar` crash)
- File: `src/components/social/ReactionBar.tsx` line 130 — `mine?.has(r.kind)` fails because `mine` is sometimes an array, not a `Set`.
- Fix: normalize `mine` to a `Set<string>` once with `useMemo`, or guard with `Array.isArray(mine) ? mine.includes(...) : mine?.has?.(...)`.
- Why first: nothing else can be visually verified while Home crashes.

### Step 2 — Make "Add another pet" reuse the rich wizard
- File: `src/pages/onboarding/AddAnotherPet.tsx` — change the "Add another pet" card to navigate to `/onboarding?stage=add-pet` **and** in `Onboarding.tsx` map stage `add-pet` to `<FirstPetWizard isAdditional onDone={() => setStage("add-another")} />` (already partially done — verify the path actually renders the rich wizard, not the legacy `QuickAddPet`). If `add-pet` currently maps to `QuickAddPet`, repoint it.
- Result: 2nd/3rd pets get the same temperament/allergy/conditions capture, with vet & reminder sections hidden.

### Step 3 — Parent-aware `WizardSteps` (6-dot progress)
- File: `src/components/onboarding/WizardSteps.tsx` — already accepts `labels[]`. No change needed there.
- File: `src/pages/Onboarding.tsx` — for pet-parent path, pass `labels={["Account","About you","Pet","More?","Goals","Done"]}` and compute `current` from current `stage`. For other roles keep the existing 3-step labels.

### Step 4 — `PetParentHome` reorders modules by `profiles.goals[]`
- File: `src/pages/home/PetParentHome.tsx`.
- Read `profile.goals` (array) once. Define a static `MODULE_PRIORITY` mapping: `vet→AskVet card`, `social→PostFeed`, `mating→MatesRail`, `services→ServicesRail`, `lost_found→MissingFeed`, etc.
- Sort/pin the corresponding sections to the top in the order the user picked them; everything else falls below.
- Add a tiny "Personalised for: 🩺 Vet · 🐾 Mates" chip strip near the greeting so the user sees it worked.

### Step 5 — Fade transitions between stages
- File: `src/pages/Onboarding.tsx` — wrap the stage switch body in a `framer-motion` `<AnimatePresence mode="wait">` with `key={stage}`, `initial/animate/exit opacity` (0.2s). `framer-motion` is already in deps.

### Step 6 — Manual end-to-end verification (I drive, no guessing)
Using the browser tool against the preview URL, signed in as the current user:
1. Open `/onboarding?stage=identity` → confirm avatar uploader works (file picker + preview).
2. Advance through `role → parent` → fill rich `FirstPetWizard` with **approx age (Y/M)**, temperament chips, reminders ON, vet phone.
3. Confirm new row appears in `pets` (read_query) with `approx_age_months` set, `date_of_birth` derived by trigger, `temperament[]` populated, `health_setup_complete=true`.
4. Confirm `vaccinations` rows seeded for that pet (read_query).
5. Tap "Add another pet" → confirm rich wizard opens with vet/reminders hidden.
6. Skip to Goals → pick 3 goals → confirm `profiles.goals` updated (read_query) and `profiles.onboarded=true`.
7. Land on `Done` → confetti, summary card shows correct pet count + reminders + goals.
8. Navigate `/` → confirm modules reordered, personalised chip visible, no console errors.
9. Hard refresh mid-flow at each stage → confirm resume.

Any failure found → fix before declaring done.

---

## Files Touched (final list, no overlap)

| Step | File | Change |
|---|---|---|
| 1 | `src/components/social/ReactionBar.tsx` | Normalize `mine` to Set |
| 2 | `src/pages/onboarding/AddAnotherPet.tsx`, `src/pages/Onboarding.tsx` | Route "add-pet" stage to `<FirstPetWizard isAdditional/>` |
| 3 | `src/pages/Onboarding.tsx` | Pass parent labels to `WizardSteps` |
| 4 | `src/pages/home/PetParentHome.tsx` | Reorder modules by `goals[]` + chip strip |
| 5 | `src/pages/Onboarding.tsx` | `AnimatePresence` wrapper |
| 6 | none (verification only) | Browser + DB checks |

No DB migrations needed. No new components.

---

## Final Pet Parent User Journey (post-build)

```text
Sign up (email/Google)
        │
        ▼
[/onboarding · stage=identity]
   Name · @handle (live check) · City (geolocate) · Avatar · Lang · Units
        │
        ▼
[stage=role]  → choose "Pet parent"
        │
        ▼
[stage=parent] FirstPetWizard
   A. Photo · Name · Species · Breed (or Other) · Sex · Age (DOB or approx Y/M)
   B. Weight · Spay/Neuter · Microchip · Emergency vet name+phone
   C. Temperament · Allergies · Conditions
   D. Reminders toggle + Vaccines/Deworm/Flea/Checkup chips + channel
   → Insert pets row · trigger derives DOB · seed_pet_vaccine_reminders RPC
        │
        ▼
[stage=add-another] "Add another pet?"
   ├─ Yes → [stage=add-pet] FirstPetWizard isAdditional (vet/reminders hidden) → loop
   └─ No  → continue
        │
        ▼
[stage=goals] GoalsStep
   Multi-select goals + live preview ("Vet → AskVet on Home", etc.)
   → profiles.goals[] · profiles.onboarded=true
        │
        ▼
[stage=done] Done
   Confetti · "You're all set, {firstName}!" · Summary card
   (N pets · Reminders On/Off · N goals) · CTA "Open my home"
        │
        ▼
[/]  PetParentHome
   • Greeting with pet name + age (from derived DOB)
   • "Personalised for: …" chip strip
   • Modules reordered by goals[]
   • Vaccine reminder rows already scheduled → push notifications fire on schedule
```

Resume rules: refresh at any stage = lands on the same stage. Re-login post-onboarding = goes straight to `/`.

---

Ready to switch to build mode and execute Steps 1 → 6 in order.
