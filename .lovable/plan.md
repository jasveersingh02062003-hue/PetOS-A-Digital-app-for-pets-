I checked the codebase. The flow is only partially real today, which is why it feels broken.

What is real right now
- Everyone already uses one login page: `/auth`.
- Post-login routing exists in `/post-auth`.
- Role selection exists, but in two different places:
  - inside `src/pages/Onboarding.tsx`
  - as a separate page `src/pages/AccountTypeChooser.tsx`
- Pet parent/rescuer have a richer inline onboarding wizard in `src/pages/Onboarding.tsx`.
- Buyer has a basic preferences page: `/onboarding/buyer-prefs`.
- Provider has a separate setup flow: `/onboarding/provider`.
- Org roles have a verification flow: `/onboarding/org`.
- Admin review exists at `/admin/orgs`.
- Verified/pending org badges already exist through `SellerBadge` + `useVerifiedOrgs`.

Why it is not working as the full journey you described
- There is no single source of truth for onboarding. The app currently mixes multiple onboarding systems.
- `provider` is not part of the database `account_type` enum, so provider is treated differently from every other role. This causes routing inconsistency.
- `/onboarding/add-pet` is too shallow for your intended flow. It only asks name/species/breed and then ends.
- Pet parent onboarding does not ask:
  - first-time parent or not
  - number of pets first
  - looped pet setup for 2+ pets
  - adoption date vs birth date decision
  - “do health now or later” decision in the way you want
- Buyer, breeder, rescuer, kennel, shelter, sanctuary, zoo do not yet have equally strong role-specific question trees.
- Your requested route `/admin/org-review` does not currently exist. The real route today is `/admin/orgs`.
- Home routing is inconsistent for provider: providers land on `/provider`, while most other roles land on `/`.

Target flow to make real
```text
Install app
  -> Welcome
  -> /auth
  -> login/signup with email+password or Google
  -> /post-auth
  -> /onboarding
  -> choose role
  -> role-specific onboarding
  -> finish required setup
  -> land on role-specific home
```

Planned rewire

1. Unify onboarding into one real router
- Make `/onboarding` the only entry point for first-time users.
- Remove the current split-brain behavior between:
  - `Onboarding.tsx`
  - `AccountTypeChooser.tsx`
  - `AddFirstPet.tsx`
  - separate role branches
- Convert onboarding into a single state-driven flow with explicit branches per role.
- Persist progress after every step so refresh/back does not lose progress.

2. Fix role modeling so provider is a real first-class role
- Add `provider` to the account type model in the backend schema.
- Make role-based routing consistent in `PostAuth`, `FirstRunGate`, and `Home`.
- Ensure every role can be identified from profile state without hidden exceptions.

3. Build the pet parent onboarding exactly in the structure you want
- About the pet parent:
  - full name
  - area/location
  - age of pet parent
  - first-time pet parent? yes/no
- Pet count step:
  - 1
  - 2
  - more than 2
- Loop through pet setup for each pet:
  - pet category/species
  - breed
  - birthday or adoption date
  - optional photo/name/gender if needed by current features
- Expand supported species list beyond the current small set.
- Add a decision step:
  - set up pet health now
  - skip for later
- If user skips health:
  - onboarding still completes
  - health tab shows a clear “Set up health for this pet” CTA
  - home can surface a reminder until done

4. Build role-specific onboarding trees inspired by the same logic
- Buyer:
  - preferred species
  - preferred breed
  - city/location
  - budget range
  - adoption vs breeder preference
  - first-time pet owner or experienced
- Rescuer:
  - rescue type
  - solo or team
  - city/coverage area
  - foster capacity
  - urgent intake needs
- Breeder:
  - breeding species
  - breeds handled
  - years of experience
  - facility/individual
  - city/service area
  - then verification docs
- Kennel / Shelter / Sanctuary / Zoo:
  - org basics first
  - capacity/facility context
  - service/donation/public-facing info where relevant
  - then verification docs
- Provider:
  - personal/business basics
  - service category
  - area, availability, rates, trust docs
  - then land on provider dashboard

5. Make org verification match your requested journey
- Keep `/onboarding/org` as the verification step after org-specific questions.
- Add route alias `/admin/org-review` that points to the existing review page, while keeping `/admin/orgs` working.
- Keep pending verification state visible on org home/profile/posts.
- Ensure approved status flips the verified check immediately.

6. Make home routing truly role-specific and predictable
- After onboarding:
  - pet parent -> `/`
  - buyer -> `/`
  - breeder -> `/`
  - kennel -> `/`
  - shelter -> `/`
  - sanctuary -> `/`
  - zoo -> `/`
  - rescuer -> `/`
  - provider -> either `/provider` consistently, or move providers into `/` as well
- I recommend choosing one consistent rule:
  - either all roles land on `/`
  - or keep provider special, but then document and wire it cleanly in all gates
- My preferred implementation: all roles land on `/`, with `Home.tsx` routing to the right dashboard.

7. Add anti-drop-off UX across the whole flow
- Shorter, logical step order
- Save progress at each step
- Proper back/continue behavior
- Conditional branching instead of overwhelming forms
- Allow “skip for now” only where it will not break core flow
- Strong empty states that guide the next action instead of dead ends

Technical details
- Files likely to update:
  - `src/pages/Onboarding.tsx`
  - `src/pages/AccountTypeChooser.tsx`
  - `src/pages/onboarding/AddFirstPet.tsx`
  - `src/pages/onboarding/BuyerPrefs.tsx`
  - `src/pages/onboarding/provider/Picker.tsx`
  - `src/pages/onboarding/provider/Wizard.tsx`
  - `src/pages/OrgOnboarding.tsx`
  - `src/pages/PostAuth.tsx`
  - `src/components/FirstRunGate.tsx`
  - `src/pages/Home.tsx`
  - `src/pages/home/*`
  - `src/App.tsx`
- Backend/schema work likely needed:
  - add `provider` to account type enum
  - add onboarding progress fields to profile or a dedicated onboarding state table
  - add pet-parent-specific fields such as parent age / first-time-parent flag
  - add pet setup fields such as adoption date / health setup status / sequence count support
- Existing real features to preserve:
  - org verification badges
  - provider verification review state
  - buyer, breeder, shelter, zoo, kennel dashboards already present
  - health tab vaccination flows already present

Acceptance criteria
- A new user can go from install -> auth -> role -> tailored onboarding -> correct home without loops or confusion.
- Pet parent can add 1, 2, or many pets in sequence.
- Health can be completed now or deferred safely.
- Buyer, rescuer, breeder, provider, and org roles each get relevant questions instead of generic pet-parent questions.
- `/admin/org-review` works and points to the org review queue.
- Verified/pending badges reflect review status correctly.
- Refreshing mid-onboarding resumes from the correct step.

Implementation order
1. Fix data model and role/routing consistency.
2. Rebuild `/onboarding` as the single real flow controller.
3. Implement pet parent multi-pet + health decision flow.
4. Implement buyer/rescuer/provider/org role question trees.
5. Add admin route alias and verification polish.
6. Final pass on redirects, edge cases, and drop-off prevention.