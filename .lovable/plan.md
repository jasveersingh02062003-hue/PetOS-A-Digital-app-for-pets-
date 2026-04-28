# Plan: Neutered → Mating Discoverability Constraint

Onboarding 2.0 is already shipped. This plan covers the **one remaining refinement** from your approval message: when a pet is marked `neutered = true`, it must never be discoverable for mating, and the UI must explain this kindly rather than letting the toggle look broken.

## Scope

Enforce the rule in three layers — database (truth), backend trigger (safety net), and UI (clarity) — so it cannot be bypassed and never confuses the owner.

## 1. Database migration

New migration file: `supabase/migrations/<ts>_neutered_mating_guard.sql`

- Backfill: `UPDATE public.pets SET discoverable_for_mating = false WHERE neutered = true;`
- Trigger function `enforce_neutered_not_discoverable()` (SECURITY DEFINER, search_path = public):
  - On INSERT/UPDATE of `pets`, if `NEW.neutered = true` then force `NEW.discoverable_for_mating := false`.
- Attach `BEFORE INSERT OR UPDATE ON public.pets` trigger.
- Keep the existing `check_pet_eligible_for_mating` trigger on `mating_listings` — it already blocks listing a non-discoverable pet, so neutered pets are automatically excluded from listings too.

This means even if a client sends `{ neutered: true, discoverable_for_mating: true }`, the DB silently corrects it. No RLS change needed.

## 2. Onboarding (`src/pages/Onboarding.tsx`)

- In Chapter 7 (Safety & Consent), where the "Discoverable for mating" switch lives:
  - If `neutered === true`: render the switch as `disabled`, force its visual state to `off`, and show a small helper line:  
    *"Since {petName} is neutered, mating discovery is turned off. You can still use every other feature."*
  - On submit, force `discoverable_for_mating: neutered ? false : discoverable` before the insert (defense in depth, matches DB trigger).

## 3. Settings → Per-pet privacy (`src/pages/settings/Privacy.tsx`)

- Fetch `neutered` alongside the other pet fields.
- For each pet card:
  - If `neutered`: disable the toggle, show it as off, and render the same kind helper note referencing the pet's name.
  - Otherwise: behave exactly as today.

## 4. Pet editor (`src/pages/settings/PetEditor.tsx`)

- When the user flips the **Neutered** switch ON:
  - Immediately also set `discoverable_for_mating = false` in local state and on save.
  - Show a one-line toast: *"Mating discovery turned off because {petName} is neutered."*
- No change when flipping neutered OFF (owner must opt back in via Privacy settings).

## 5. Mating new listing (`src/pages/MatesNew.tsx`)

- The pet picker already filters by `vaccination_verified && discoverable_for_mating`, so neutered pets disappear automatically once the trigger runs. No further code change required, but add a subtle empty-state line:  
  *"Neutered pets and unverified pets are not shown here."*

## Out of scope

- No changes to `mating_listings`, `mating_requests`, AI prompt, EmergencySheet, or notification logic — all remain as shipped in Onboarding 2.0.
- No new tables, enums, or RLS policies.

## Files touched

- **NEW** `supabase/migrations/<ts>_neutered_mating_guard.sql`
- **EDIT** `src/pages/Onboarding.tsx`
- **EDIT** `src/pages/settings/Privacy.tsx`
- **EDIT** `src/pages/settings/PetEditor.tsx`
- **EDIT** `src/pages/MatesNew.tsx`

## Order of operations

1. Run the migration (backfill + trigger).
2. Update the four frontend files.
3. Verify in preview: neutered toggle in PetEditor flips discoverability off; Privacy page shows disabled state with note; Onboarding chapter 7 hides the option for neutered pets; mating listing flow no longer offers them.

Approve and I'll ship it in that exact order.