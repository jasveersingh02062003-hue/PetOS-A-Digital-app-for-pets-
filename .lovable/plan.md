
# Final rewire pass — health reminders + deeper role trees

The previous pass landed schema + pet-parent flow + multi-pet loop. This pass closes the loop on the remaining items from the approved scope.

## 1. Deferred-health reminder cards

Goal: any pet with `health_setup_complete = false` should nudge the parent to finish setup, in two places.

- **New shared component** `src/components/health/HealthSetupReminder.tsx`
  - Queries pets where `health_setup_complete = false`
  - Renders a dismissible card: "Finish health setup for {name}" → links to `/health` with that pet preselected
  - Variants: `compact` (Home) and `full` (Health tab)
  - Dismissal stored in `localStorage` per-pet for the Home variant; the Health-tab variant is non-dismissible

- **`src/pages/home/PetParentHome.tsx`** — mount `<HealthSetupReminder variant="compact" />` near the top welcome block.

- **`src/pages/Health.tsx`** — mount `<HealthSetupReminder variant="full" />` above the existing alerts banner. Clicking "Set up now" opens the existing add-pet/edit flow with `health_setup_complete` set to true on save.

## 2. Buyer flow — deepen the question tree

`src/pages/onboarding/BuyerPrefs.tsx` currently asks only species/breed/city/price. Add:

- **Living situation** chips: Apartment / House w/ yard / Farm
- **Experience** chips: First-time / Some / Experienced
- **Time available daily** chips: < 1h / 1–3h / 3+ h
- **Purpose** chips: Companion / Guard / Show / Therapy
- **Budget range slider** (replace single max-price input)
- All optional, persist into `profiles.looking_for` JSON; keep "Skip" path.

## 3. Rescuer / Shelter flow

New `src/pages/onboarding/RescuerProfile.tsx` (routed `/onboarding/rescuer`):
- Capacity (pets you can house), service area (city + radius km), species you take, urgent-foster toggle
- Persist to `org_profiles` (rescuer/shelter use the same table) with `org_type` set automatically
- Then route to `/onboarding/org` for document verification (existing page)

## 4. Breeder / Kennel flow

New `src/pages/onboarding/BreederProfile.tsx` (routed `/onboarding/breeder`):
- Breeds specialised in (multi-select), years of experience, KCI member toggle, # of breeding pairs
- Persist to `org_profiles`; then route to `/onboarding/org`

## 5. Org / Sanctuary / Zoo

`OrgOnboarding.tsx` already covers the verification step. Add a small intro card explaining what documents are needed and expected review time so users don't drop off.

## 6. Onboarding router glue

Update `src/pages/Onboarding.tsx` switch on `account_type`:
```text
pet_parent  → existing parent-age + multi-pet loop
buyer       → /onboarding/buyer-prefs
breeder/kennel → /onboarding/breeder → /onboarding/org → /onboarding/done
shelter/rescuer → /onboarding/rescuer → /onboarding/org → /onboarding/done
sanctuary/zoo  → /onboarding/org → /onboarding/done
provider    → /provider (skip onboarding wizard, already saved)
```

## 7. Routes

In `src/App.tsx`, register:
- `/onboarding/rescuer` → `RescuerProfile`
- `/onboarding/breeder` → `BreederProfile`

## 8. Done page polish

`src/pages/onboarding/Done.tsx`: role-aware CTA — pet parents → "Open my pet's home", buyers → "Browse adoptions", orgs → "Go to my dashboard".

## Technical notes

- No new schema changes needed; all new role data fits in existing `org_profiles` columns or `profiles.looking_for` JSON.
- Reminder component uses the same `usePets()` hook already in `Health.tsx`, so no extra queries.
- All new pages follow the existing `WizardSteps` + `container-app` layout pattern for visual consistency.

## Out of scope for this pass

- Admin moderation UI changes (already aliased to `/admin/org-review`)
- Pet-health onboarding screens themselves (existing Health vault tab already handles it)

Approve and I'll implement all of the above in the next message.
