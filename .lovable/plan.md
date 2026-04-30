## Goal

Make `/onboarding` a unified, Instagram-style flow where every role passes through one **universal identity step** (handle, name, city, language, units), then a **role picker**, then a **role-specific mini-flow**, then a **role-aware Done screen** that lands them on the correct home. The pet-parent wizard stops asking pet-health questions (weight, allergies, conditions, vaccines) — those move to the Health Vault setup.

---

## What's already in place (keep)

- DB: `profiles.handle` (unique, case-insensitive index), `language`, `units`, `looking_for`, `account_type`, `onboarded`, `parent_age`, `first_time_parent` — all present.
- `/onboarding` is already the single URL with `?stage=` state machine.
- Role-specific pages exist: `BuyerPrefs`, `RescuerProfile`, `BreederProfile`, `OrgOnboarding`, `provider/Picker`, `AddFirstPet`, `AddAnotherPet`, `Done`.
- Role-aware `Home.tsx` already routes to `PetParentHome | BuyerHome | BreederHome | KennelHome | ShelterHome | GaushalaHome | ZooHome`.
- `HealthSetupReminder` already nudges for incomplete pets on Home + Health.

---

## What changes

### 1. New universal stage: `identity` (Chapter 0, everyone)

Add a new first stage before role selection. Single screen with:
- **Full name** (text)
- **@handle** — auto-suggested from name/email, debounced uniqueness check against `profiles` (case-insensitive), green check when free, inline error if taken. Slug rules: 3–24 chars, `[a-z0-9_.]`, must start with a letter.
- **City** (text + "Detect" button — reuses existing `detectCity` Nominatim flow)
- **Language** (en / hi / etc. — Select)
- **Units** (kg/lb, °C/°F — toggle pair)

On Continue: upsert `profiles { full_name, handle, city, lat, lng, language, units }` then go to `stage=role`.

If the user already has a `handle` saved, this stage auto-skips to `role` (so refreshes / returners don't repeat it).

### 2. Strip pet-health from the parent wizard

In `Onboarding.tsx` parent wizard remove these from the form & submit payload:
- weight, neutered, activity, diet, allergies, conditions, temperament, social level, discoverable, vaccine file upload.

Keep only: pet avatar, name, species, breed, DOB/gotcha, gender. Insert pet with `health_setup_complete: false`. The existing `HealthSetupReminder` on Home + Health Vault will handle the rest (already wired).

After insert, go to `stage=add-another` (existing screen) or `stage=done`.

### 3. Role picker becomes simpler

Remove the "Welcome cards" intro step (steps 0–1 of the parent wizard). After identity, show role grid directly. Saving role triggers `stage=<role-mini-flow>`.

### 4. Role mini-flows — confirm wiring

| Role | Stage | Screen | Lands on |
|---|---|---|---|
| pet_parent | `parent` (pet-add only) → `add-another` → `done` | inline | `/` (PetParentHome) |
| buyer | `buyer` | `BuyerPrefs` | `/` (BuyerHome) |
| provider | `provider` | `provider/Picker` → category wizard | `/provider` |
| rescuer | `rescuer` | `RescuerProfile` | `/` (ShelterHome rescuer) |
| breeder / kennel | `breeder` | `BreederProfile` → `org` (verification) | `/` (BreederHome / KennelHome) |
| shelter | `rescuer` (capacity) → `org` (verification) | sequence | `/` (ShelterHome) |
| sanctuary / zoo | `org` | `OrgOnboarding` | `/` (Gaushala/Zoo home) |

Each role mini-flow ends by dispatching `window.dispatchEvent(new CustomEvent("onboarding:advance", { detail: { next: "done" } }))` (mechanism already exists in controller). Audit each existing screen to ensure they fire it instead of `nav("/onboarding?stage=done")` so the controller stays the source of truth. (Most already do per recent rewire.)

### 5. `Done.tsx` — already role-aware, just verify CTAs

- pet_parent → `/` "Open your pet's home"
- buyer → `/mates?tab=adopt` "Browse adoptions"
- provider → `/provider` "Open dashboard"
- breeder/kennel/shelter/sanctuary/zoo → `/` (with pending-verification badge already shown by org pages)
- rescuer → `/` "Open dashboard"

On click: set `profiles.onboarded = true`, then navigate.

### 6. PostAuth gate

`PostAuth.tsx` currently treats missing `full_name` or `onboarded=false` as incomplete → routes to `/onboarding`. Add `handle` to the completeness check so anyone without a handle is forced through the new identity step.

---

## Files

**Edit**
- `src/pages/Onboarding.tsx` — add `identity` stage as new default; remove welcome+role-only intro steps from parent wizard; strip health fields from parent submit; route role-picker → identity → role mini-flow.
- `src/pages/PostAuth.tsx` — include `handle` in completeness check.
- `src/pages/onboarding/AddFirstPet.tsx` — strip any health questions still present (weight/allergies/etc.); insert pet with `health_setup_complete: false`.
- `src/pages/onboarding/AddAnotherPet.tsx` — same, strip health.
- `src/pages/onboarding/Done.tsx` — set `onboarded=true` on CTA click; verify role-aware copy.

**New**
- `src/components/onboarding/IdentityStep.tsx` — the Chapter 0 form (name, @handle with live uniqueness check, city + detect, language, units). Encapsulated so the controller stays readable.
- `src/lib/handle.ts` — `slugifyHandle(input)` + `isHandleAvailable(supabase, handle, currentUserId)` helper using the existing case-insensitive index.

**No DB migration needed** — `handle`, `language`, `units`, all role columns already exist.

---

## Acceptance

1. Brand-new signup → lands on `/onboarding`, sees **identity** step first.
2. Handle field shows live availability (green check / red error), can't continue if taken or invalid.
3. After identity → role picker → role mini-flow (no URL change, always `/onboarding`).
4. Pet parent flow no longer asks weight / vaccines / allergies. Pet is created with `health_setup_complete=false`. Health tab shows the existing setup prompt.
5. Each role's Done screen lands on the correct home; `onboarded=true` is persisted.
6. Refreshing mid-flow resumes at the correct stage based on saved profile fields (handle exists → skip identity; account_type exists → skip role picker).
7. Returning users (handle + onboarded + role-appropriate gate) skip onboarding entirely from `/post-auth`.
