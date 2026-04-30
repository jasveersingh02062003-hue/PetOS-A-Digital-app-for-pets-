# Fix the 4 onboarding flow gaps

Small, surgical edits to make every role land on the same unified completion screen and make `onboarded=true` resilient.

## 1. Buyer routes through Done
`src/pages/onboarding/BuyerPrefs.tsx` — change `onSuccess` to `nav("/onboarding?stage=done", { replace: true })` instead of jumping straight to `/mates?tab=adopt`. The Done screen's CTA already takes buyers to `/mates?tab=adopt`, so they still land in the right place — but they get the unified "You're all set" moment first.

## 2. Mark `onboarded=true` on org submit
`src/pages/OrgOnboarding.tsx` — in the `submit` mutation, after the `org_profiles` upsert, also do `supabase.from("profiles").update({ onboarded: true }).eq("id", u.user.id)`. This way if a sanctuary/zoo/breeder/shelter user closes the tab after submitting docs, `PostAuth` won't keep dragging them back to `/onboarding`.

## 3. Rename `AddFirstPet` → `QuickAddPet`
The file is currently used for pets 2+, not the first pet. Rename:
- `src/pages/onboarding/AddFirstPet.tsx` → `src/pages/onboarding/QuickAddPet.tsx`
- Update the lazy import in `src/pages/Onboarding.tsx` (line 66)
- Update the lazy import in `src/App.tsx` (line 141)
- Update the JSX heading inside the file from "Add a pet" stays fine, but rename the exported function from `AddFirstPet` to `QuickAddPet`.

## 4. Role-aware labels on the Done screen
`src/pages/onboarding/Done.tsx` line 61 hardcodes `["Account type", isOrg ? "Verification" : "Add a pet", "All set"]`. Replace with role-aware middle label:
- buyer → "Preferences"
- provider → "Your service"
- org types → "Verification" (already)
- pet_parent → "Add a pet" (already)

## Out of scope
Provider Wizard's onboarded flag and HealthSetupReminder mounting — flagged in the reality check but not part of this fix. Will surface separately if those turn out to be broken too.
