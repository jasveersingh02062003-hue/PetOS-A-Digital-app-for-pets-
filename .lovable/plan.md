# Execution Plan — Role Identity, Universal Posting & Role Dashboards

Sequenced build plan. Each phase ships a usable improvement. Defaults locked unless you override before we start.

---

## Phase 0 — Locked decisions (defaults)

| Decision | Default |
|---|---|
| Org post author | Org name + org logo (Instagram-style). Person hidden, shown on org profile as "managed by" |
| Gaushala top KPI | Animals in care (donations second) |
| Verified tick | Auto-flip when `org_profiles.status = 'approved'`. Admin can revoke |

If any of these are wrong, say so before we start Task 1.

---

## Phase 1 — Identity foundation (universal badge + open posting)

Goal: every role can post; everywhere a user appears, you can tell what they are.

**1.1 Open the gate**
- `FirstRunGate.tsx`: only `account_type === 'pet_parent'` requires ≥1 pet. All others need only `full_name + onboarded`.
- `PostAuth.tsx`: mirror the same rule.
- `Onboarding.tsx` branches:
  - pet_parent → AddFirstPet
  - buyer → BuyerPrefs
  - breeder/kennel/shelter/sanctuary/rescuer/zoo → OrgOnboarding
  - vet → `/vet/onboarding`
  - provider → `/onboarding/provider/picker`

**1.2 `AuthorIdentity` component**
- New `src/components/AuthorIdentity.tsx`: input `userId`, renders avatar + name + `<SellerBadge>` + verified tick.
- For org accounts: shows org name + org logo as author (per Phase 0 default).
- Replace ad-hoc author rendering in: PostFeed header, CommentSheet rows, StoryRail (small role icon overlay), Notifications rows, Search results, MatesGrid, AdoptGrid, MissingStrip, services cards, UserProfile header.

**1.3 Role-tinted avatar ring**
- `getRoleRing(account_type)` util → tailwind ring class: breeder=amber, kennel=sky, shelter=lilac, sanctuary=leaf, zoo=stone, rescuer=coral, buyer=primary, vet=red, provider=primary, pet_parent=primary.
- Applied via `AuthorIdentity`.

**1.4 Universal Composer**
- `Composer.tsx`: pet-tag becomes optional. No pets → hide pet selector, allow caption + media only.
- Same for Stories composer.

**Deliverable:** any role logs in → reaches Home → can post photos/stories → role tag visible everywhere.

---

## Phase 2 — Role-aware Home dashboards

**2.1 Home router**
- Refactor `src/pages/Home.tsx` into a thin switch on `account_type`:
  ```text
  pet_parent  → <PetParentHome/>
  breeder     → <BreederHome/>
  kennel      → <KennelHome/>
  shelter     → <ShelterHome/>
  rescuer     → <ShelterHome variant="rescuer"/>
  sanctuary   → <GaushalaHome/>
  zoo         → <ZooHome/>
  buyer       → <BuyerHome/>
  vet         → redirect /vet
  provider    → redirect /provider
  ```

**2.2 Dashboards (one task each)**

| # | Dashboard | Hero KPI | Quick actions | Below fold |
|---|---|---|---|---|
| a | PetParentHome (extract current Home) | Pet card + health ring | Log meal · Walk · Ask vet | Stories, prompts, missing, feed |
| b | BreederHome | Active litters + pending mating requests | New litter · List for mating · Verify lineage | Mating inbox, enquiries, feed |
| c | ShelterHome (+Rescuer variant w/ smaller cap) | Adoptable count + open applications | List adoptable · Review apps · Post missing | App inbox, donations strip, feed |
| d | KennelHome | Today's boarders + occupancy % | Accept booking · New service slot · Daily report | Today's check-ins, services, feed |
| e | GaushalaHome | Animals in care + month donations | Add animal · Open donate · Post update | Donor wall, sponsorships, feed |
| f | BuyerHome | Saved searches + new matches | Browse adopt · Browse breeders · Post wanted | Recommended pets, breeders nearby, feed |
| g | ZooHome | Animals on display + today's events | Add exhibit · Educational post · Event | Events, posts, feed |

All reuse existing data hooks — composing new screens, not new APIs.

**2.3 Role-aware `ContextualFab`**
- breeder → New litter · Mating availability · Photo
- shelter/rescuer → List for adoption · Urgent case · Donation drive
- sanctuary → Animal in care · Sponsorship · Donation drive
- kennel → Boarding slot · Promo · Photo
- zoo → Education post · Visitor announcement
- vet → Open consult · Prescription
- buyer → Photo · Story · Wanted post
- pet_parent → Photo · Story · Log

---

## Phase 3 — Search by entity type

- `Search.tsx` gets tabs: People · Pets · Breeders · Kennels · Shelters · Sanctuaries · Rescuers · Zoos · Vets · Services.
- Each tab queries the right table (profiles filtered by `account_type`, `pets`, `service_listings`, etc.).
- Rows render via `<AuthorIdentity>`.
- `/discover` gets a top filter chip row with the same entity types.

---

## Phase 4 — Public profile per role

`UserProfile.tsx` becomes role-aware:
- breeder → Litters · Mating availability · Reviews
- kennel → Services · Boarding · Reviews
- shelter/rescuer → Adoptables · Donate CTA · Stories
- sanctuary → Animals · Sponsorships · Donate CTA
- zoo → Exhibits · Events · Educational posts
- vet → Specialisations · Book appointment · AskVet answers
- pet_parent / buyer → existing layout

Header banner colour matches role tint.

---

## Phase 5 — Polish (parallelisable)

- Auto-flip verified tick on `org_profiles.status='approved'` (ensure `useVerifiedOrgs` invalidates on KYC approval).
- Notification rows use `AuthorIdentity` (role + tick on every "X liked your post").
- Video post type in Composer + feed renderer.
- Per-role onboarding copy & illustrations.
- Boost/promote post type for kennels (paid).

---

## Task tracker breakdown (in execution order)

1. Open FirstRunGate for non-pet-parent roles
2. Build AuthorIdentity component + role rings
3. Replace author rendering across feed, comments, stories, search, notifications
4. Universal Composer (optional pet tag)
5. Home router by account_type
6. PetParentHome (extract current)
7. BreederHome
8. ShelterHome (+ Rescuer variant)
9. KennelHome
10. GaushalaHome
11. BuyerHome
12. ZooHome
13. Role-aware ContextualFab
14. Search entity-type tabs
15. Role-aware UserProfile
16. Verified tick auto-flip + notification badges
17. Video post type (later)

---

## Out of scope (explicitly not in this plan)

- New backend tables — reuses existing schema (`profiles`, `org_profiles`, `pets`, `litters`, `service_listings`, `donations`, etc.). Migrations only if a dashboard reveals a missing column.
- Payment flows for donations/boosts (existing donate/Stripe stays as-is).
- Mobile-app shell changes.

## Technical notes

- All role checks read `profiles.account_type`; org status from `org_profiles.status`.
- `AuthorIdentity` will be the single source of truth — no other component should render `<Avatar+name+badge>` manually after Phase 1.3 lands.
- Dashboards are pure composition over existing hooks (`usePets`, `useLitters`, `useAdoptables`, `useBookings`, `useDonations`, …); if a hook is missing, we add it in that dashboard's task.
- `getRoleRing` lives in `src/lib/roleTheme.ts` alongside existing role colour helpers.

Approve and I'll switch to build mode and start with task 1 (FirstRunGate), one task in_progress at a time.
