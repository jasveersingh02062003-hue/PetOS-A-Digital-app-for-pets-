# Implementation Plan — 5 Priority Features

Builds on what already exists. Nothing here throws away current work — it extends it.

---

## Priority 1 — Buyer-only mode ("Looking for a pet")

**Goal:** Let a user sign up purely to browse & buy, without forcing them to add a pet.

**DB migration**
- Add `'buyer'` to the `account_type` enum.
- Add `profiles.looking_for jsonb` (nullable) — stores buyer preferences `{ species, breed, city, max_price_inr }`.

**UI changes**
- `src/pages/AccountTypeChooser.tsx` — add a new option at the top:
  - value: `buyer`, title: "Looking to get a pet", sub: "Browse adoption & breeders, no pet required", icon: `Search`, `needsOrg: false`, `skipAddPet: true`.
- After selecting `buyer`: skip `/onboarding/add-pet`, go straight to `/onboarding/buyer-prefs` (new lightweight 1-screen form: species multi-select + city + price range, all optional → Save → `/mates?tab=adopt`).
- `src/components/onboarding/WizardSteps.tsx` — show 2-step flow (Account type → Preferences) for buyers instead of 3.
- `src/pages/Profile.tsx` — when `account_type === 'buyer'` AND no pets, show a "Looking for a pet 🔍" hero card instead of the empty pet rail, with a CTA to edit preferences.

**Routing**
- `src/App.tsx` — add `/onboarding/buyer-prefs` route.

---

## Priority 2 — Split `/mates` into "Find a mate" vs "Adopt or buy"

**Already in place:** `src/pages/Mates.tsx` already has a 2-tab toggle (`mating` / `adopt`) wired via `?tab=` query param. The split exists; it just needs polish + entry-point clarity.

**Changes**
- `src/pages/Mates.tsx`
  - Promote tabs visually: bigger labels, active-tab underline accent, distinct icons (Heart for Mate, PawPrint for Adopt).
  - Different sub-headlines per tab (already there) — keep.
  - For buyers (`account_type === 'buyer'`), default tab → `adopt`, hide the "List your pet" CTA in the mating tab.
  - For pet parents with no opposite-sex pet, show a soft hint in the mating tab: "Mating works best when your pet's profile is complete."
- `src/components/BottomNav.tsx` — keep single Mates entry; deep-link from Home quick-actions: "Buy a pet" → `/mates?tab=adopt`, "Find a mate" → `/mates?tab=mating`.
- `src/components/AdoptGrid.tsx` — already has city + Bred-on-PetOS filters. Add a price-range slider (min/max INR) and a species chip row at the top. Persist filter state in URL params so links are shareable.

---

## Priority 3 — Instagram-like profile (3 zones)

**Goal:** Profile page = human header + pet rail + content tabs.

**DB migration**
- `profiles.cover_url text` (nullable).
- `profiles.handle text unique` (nullable; lowercase, alphanumeric + underscore). Backfill from email local-part on first save.
- `pets.status_chip text` (nullable, enum-like: `available_for_stud` | `for_sale` | `chilling`).

**UI — `src/pages/Profile.tsx` (own profile) and `src/pages/UserProfile.tsx` (others)**

Three zones:
1. **Header zone**
   - Cover photo (16:6 aspect). Tap-to-upload on own profile (uses existing `ImageUpload` + `uploadImage` lib).
   - Avatar (already exists), name, `@handle`, city, `SellerBadge` (account-type chip).
   - Bio (one-liner from `profiles.bio`).
   - Action buttons: own profile → `[Edit] [Share]`; others → `[Follow] [Message] [Share]` (Follow + Message components already exist).
   - Counts row: posts · followers · following (already there).

2. **Pet rail (horizontal scroll)**
   - One card per pet from `usePets()` + a trailing `[+ Add]` card.
   - Each card: avatar, name, species emoji, age, status chip if any.
   - Tap → `/pet/:id` (already routed to `PetProfile.tsx`).

3. **Content tabs**
   - Tabs: `Posts` | `Tagged` | `Pets`.
   - Posts: existing `PostGrid` filtered by `author_id`.
   - Tagged: posts where this user's pets appear in `post_collabs` (table already exists per `useCollabs`).
   - Pets: vertical list view of all pets with bio + status chip.

**Pet mini-profile polish — `src/pages/PetProfile.tsx`**
- Surface `pets.bio`, age, breed, sex, weight at the top.
- Add `LineageTree` component (already built) below health section.
- Add a status chip selector (own pet only): Chilling / Available for stud / For sale.
- "All posts tagged with this pet" rail at the bottom.

**Settings stays separate** — `/settings` already has bio/pets/privacy editors. Add a "Cover photo" + "Handle" row to `src/pages/settings/AboutYou.tsx`.

---

## Priority 4 — Litter creation flow

**Goal:** Breeders can link sire + dam + pups, auto-tagging pups as "Bred on PetOS".

**Already in place:** `litter_groups` table with sire/dam/birth_date; `pets.litter_id`, `sire_pet_id`, `dam_pet_id`, `bred_on_petos` columns.

**DB**
- DB trigger on `pets` insert/update: when `sire_pet_id` AND `dam_pet_id` are both set AND both reference real pets in our DB, set `bred_on_petos = true` automatically. (Replaces relying on UI to set it.)

**UI — new page `src/pages/LitterNew.tsx`**
- Step 1: Pick dam (mother) — must be one of my pets, female.
- Step 2: Pick sire (father) — search by `public_id` or username; can be my pet or another user's. If another user's, store the reference.
- Step 3: Birth date + notes.
- Step 4: Add pups loop — for each pup: name, gender, color/markings, photo. Each pup is inserted into `pets` with `owner_id = me`, `litter_id`, `sire_pet_id`, `dam_pet_id` set → trigger flips `bred_on_petos`.
- Final: "List this litter for sale?" → bulk-create `pet_listings` rows pointing at each pup.

**UI — extension to existing pages**
- `src/pages/Profile.tsx` (when `account_type` ∈ `breeder` | `kennel`) → add tabs `Available litters` and `Past litters` to the content-tabs zone.
- Entry point: a `[+ New litter]` button in the breeder profile header.

**Route**
- Add `/litters/new` and `/litters/:id` to `src/App.tsx`.

---

## Priority 5 — Shelter donate button (UPI deep link)

**Already in place:** `org_profiles.donation_upi`, `donation_url`, status approval flow.

**UI changes**
- `src/pages/OrgProfile.tsx`
  - When `org_type` ∈ `shelter` | `sanctuary` AND `status === 'approved'` AND `donation_upi` present → primary CTA becomes `[💗 Donate]` (purple/pink).
  - Tap opens a sheet with two actions:
    - "Pay via UPI app" → `upi://pay?pa=<donation_upi>&pn=<org_name>&cu=INR` (works on Android; falls back to copy on desktop).
    - "Open donation page" → external link (`donation_url`).
    - "Copy UPI ID" → toast.
- `src/components/AdoptGrid.tsx` — for shelter listings, swap the price chip for a "Free · adoption" chip and surface a small "💗 Donate" link under the seller name.
- `src/pages/settings/AboutYou.tsx` (org users) — add UPI ID + donation URL fields with a small QR preview (use any QR lib already in deps, or skip QR if none).

---

## Cross-cutting: account-type differentiation in feeds

Already mostly done via `SellerBadge` + `BredOnPetosRibbon`. Two small adds:

- `src/components/AdoptGrid.tsx` cards
  - Show coloured badge tone matching account type (already does).
  - Add a yellow `⚠️ Repeat seller` chip when the listing's owner is a `pet_parent` with ≥3 active `pet_listings`. Compute via a small Postgres view `repeat_sellers` selecting `owner_id` having `count(*) >= 3` from active listings; query alongside the grid.

---

## Build order (suggested)

1. DB migration (one combined): enum value `buyer`, `profiles.cover_url` + `handle` + `looking_for`, `pets.status_chip`, `bred_on_petos` trigger, `repeat_sellers` view.
2. Buyer mode: AccountTypeChooser + buyer-prefs page + Profile empty-state.
3. Mates tab polish + filter additions.
4. Profile redesign zones (cover upload, pet rail polish, tabs).
5. Pet mini-profile polish (status chip, lineage, tagged posts rail).
6. Litter creation flow.
7. Shelter donate sheet + listing-card free chip.
8. Repeat-seller warning chip.

---

## Technical details

- All new tables/columns use RLS following the existing patterns (owner-only writes, public-or-approved reads).
- `handle` uniqueness enforced via Postgres unique index, case-insensitive (`lower(handle)`).
- The `bred_on_petos` trigger is idempotent — re-runs safely on update.
- UPI deep links are client-side only; no backend.
- Buyer accounts skip pet-based RLS — most of their reads are on public listings, so existing policies already cover them.
- Repeat-seller view is a regular `view`, not materialized — counts are small.

---

## Out of scope for this plan (intentional)

- Reels (mentioned in profile mockup but not in priorities).
- Symbolic adoption / zoo donate flow.
- Staff sub-accounts for kennels.
- Adoption applications (treat as a future replacement for ownership-transfer for shelters).

If you approve, I'll start with the migration + Priority 1 in the next message.
