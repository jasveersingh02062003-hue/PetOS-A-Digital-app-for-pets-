# Finish PetOS — Closing Plan (Option E, ordered)

This plan executes the remaining items in dependency order so each step unblocks the next. All five items below ship in this single round.

---

## Step 1 — Patch the public RPCs (3b)

**Why:** `UserProfile.tsx` and pet cards across the app go through `get_profiles_public` / `get_pets_public`. They currently don't return `cover_url`, `handle`, `account_type`, `status_chip`, or `bred_on_petos`, so the new Instagram-style profile and the breeding/sale chips are invisible to anyone but the owner.

**Migration:**
- `DROP` and recreate `public.get_profiles_public()` to also return: `handle`, `cover_url`, `account_type`.
- `DROP` and recreate `public.get_pets_public()` to also return: `status_chip`, `bred_on_petos`, `date_of_birth` (already there), `sire_id`, `dam_id` (needed for lineage on pet profile).
- Recreate the `profiles_public` and `pets_public` views on top.
- Re-grant `EXECUTE` to `authenticated` only.

**Code:** No client changes needed for existing call sites (they spread `*`). `UserProfile.tsx` will switch from the direct table read fallback back to the RPC for handle resolution.

---

## Step 2 — Litter Creation Flow (Priority 4)

**Why:** the `tg_pets_auto_bred` trigger only fires when both `sire_id` and `dam_id` on a pup point at registered pets. Today there is no UI to set those FKs, so the "Bred on PetOS" badge never appears.

**DB (migration):**
- Add `pets.sire_id uuid` and `pets.dam_id uuid` columns if not already present (check first; trigger from Priority 1 already references them — confirm and add if missing).
- Add `litter_groups.litter_pet_ids uuid[]` for fast read, OR use a join table `litter_pets(litter_id, pet_id)`. Pick the join table — cleaner.
- Migration: `CREATE TABLE public.litter_pets (litter_id uuid REFERENCES litter_groups ON DELETE CASCADE, pet_id uuid REFERENCES pets ON DELETE CASCADE, PRIMARY KEY(litter_id, pet_id))` with RLS mirroring `litter_groups`.

**UI — new route `/litters/new` (4-step wizard):**
1. **Pick dam** — searchable list of user's female pets.
2. **Pick sire** — two tabs: "My pets" (males I own) or "Partner's sire" (search any pet by `@handle` or public_id, sends an attribution request).
3. **Add pups** — multi-add: each pup gets name, gender, DOB (defaults to litter birth date), avatar. Creates `pets` rows owned by the dam owner with `sire_id`/`dam_id` set → trigger flips `bred_on_petos = true`.
4. **Review & publish** — creates `litter_groups` row + `litter_pets` rows, optionally creates a feed post "New litter born".

**Profile integration:**
- Breeder profile gets a **"Litters"** tab listing `litter_groups` they created, each card showing dam, sire, pups (with "Bred on PetOS" ribbon).
- "+ New Litter" CTA visible only to `breeder` / `kennel` account types.

---

## Step 3 — Donate Button on Shelter Profiles (Priority 5)

**Why:** unlocks the NGO use case; data already exists.

**UI:**
- New component `<DonateButton orgProfile={...} />` — primary CTA on `UserProfile` when viewed user's `org_profile.org_type` is `shelter` or `ngo` and `status = 'approved'`.
- Click opens a sheet `<DonateSheet />`:
  - If `donation_url` → "Donate via website" button (opens external).
  - If `donation_upi` → shows UPI ID with copy button + auto-generated `upi://pay?pa=...&pn=...` deep link (opens UPI apps on mobile).
  - Footer: "PetOS does not process donations. You're paying the shelter directly."
- Settings: shelter owners get fields for `donation_url` and `donation_upi` in their org settings page (extend existing `OrgSettings` form).

---

## Step 4 — Account-Type Badges & Verification Tick everywhere

**Why:** trust signal; users can't tell a breeder apart from a pet parent today outside of Mates.

**Touchpoints (reuse existing `<SellerBadge>`):**
- `UserProfile.tsx` and `Profile.tsx` headers — already done; verify it reads `account_type` from RPC after Step 1.
- `PostCard` author row — add small badge next to the name.
- `PostGrid` / search result rows — same.
- Comments author line — same.
- `AdoptGrid` already has it.

**Verification tick logic (centralize in `SellerBadge`):**
- For `breeder` / `kennel` / `shelter` / `ngo` / `vet`: show a blue check **only if** there's an `org_profiles` row for that user with `status = 'approved'`.
- Add a small `useVerifiedOrgs(userIds)` hook that batch-fetches approved org_profiles for a set of user IDs and caches via React Query, so we don't N+1.

---

## Step 5 — Instagram-style Pet Profile (`/pet/:id`)

**Why:** the pet rail links here, but the page is the legacy layout. Pet mini-profile is a key buyer trust surface (lineage, vaccinations, posts).

**New layout for `PetProfile.tsx`:**
- **Header:** cover photo (full-bleed), avatar overlapping bottom-left, name + species/breed chip + age, status chip (`available_for_stud` / `for_sale` / `chilling`), "Bred on PetOS" ribbon if true.
- **Owner row:** "Owned by @handle" with `<SellerBadge>` — links to user profile.
- **Action row:** Follow pet · Message owner · (if for_sale → "View listing") · (if stud → "Request mating").
- **Stat strip:** Posts · Followers · Litters · Achievements counts.
- **Tabs:**
  - **Posts** — feed posts where this pet is tagged (uses existing `post_pets` table).
  - **Lineage** — reuses `<LineageTree>` (already built) showing sire/dam/grandparents.
  - **Health** — vaccination verified badge, dewormer status (read-only public summary; full records stay owner/vet only).
  - **Gallery** — reuses `<PhotoGallery>`.
  - **Achievements** — rows from `achievements` table.

**Data:** all reads via `get_pets_public` (now richer after Step 1). Owner-only edit affordances appear when `owner_id === auth.uid()`.

---

## Technical Details

```text
Order of execution:
  1. Migration A: extend public RPCs            → unblocks 4, 5
  2. Migration B: litter_pets table + sire/dam  → unblocks 2, 5 lineage
  3. Code: Litter wizard + breeder profile tab
  4. Code: DonateSheet + org settings fields
  5. Code: badges in PostCard/PostGrid/comments + useVerifiedOrgs hook
  6. Code: PetProfile redesign
```

**Files created:**
- `supabase/migrations/<ts>_extend_public_rpcs.sql`
- `supabase/migrations/<ts>_litter_pets.sql`
- `src/pages/litters/NewLitter.tsx` (wizard)
- `src/components/litters/PickDam.tsx`, `PickSire.tsx`, `AddPups.tsx`, `LitterReview.tsx`
- `src/components/DonateButton.tsx`, `DonateSheet.tsx`
- `src/hooks/useVerifiedOrgs.ts`

**Files edited:**
- `src/pages/UserProfile.tsx` — donate CTA, switch back to RPC
- `src/pages/Profile.tsx` — Litters tab for breeders
- `src/components/social/PostCard.tsx`, `PostGrid.tsx` — author badges
- `src/components/CommentList.tsx` (or equivalent) — author badge
- `src/components/SellerBadge.tsx` — verified-from-hook
- `src/pages/settings/OrgSettings.tsx` — donation fields
- `src/pages/PetProfile.tsx` — full redesign
- `src/App.tsx` — route for `/litters/new`

**Risks / notes:**
- Adding `sire_id`/`dam_id` columns: if the Priority 1 migration already added them, the new migration uses `ADD COLUMN IF NOT EXISTS` to stay idempotent.
- `useVerifiedOrgs` must batch — render-time per-row queries would crater the feed. One query per visible page.
- Donate sheet: explicitly disclaim PetOS is not the payment processor (legal hygiene).

---

**Approve this and I'll execute Steps 1 → 5 in order.**
