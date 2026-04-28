# PetOS — Walkthrough vs Reality (final pass)

I went through every numbered concern in your walkthrough and matched it against the actual code in the repo. Almost all of it is already shipped across Phases A–D we just completed. Below is a clean status table, the remaining gaps, and a single-phase plan to close them.

## Status against the walkthrough

| Walkthrough concern | Where it lives | Status |
|---|---|---|
| 1.1 "Looking for a pet" buyer option in account chooser | `Onboarding.tsx`, `useProfile` | Done |
| 1.1 Skip add-pet for buyers, default to `/mates` adopt | `Mates.tsx` (auto-redirects buyer to `?tab=adopt`) | Done |
| 1.1 Repeat-seller warning | `AdoptListingDetail.tsx` (`activeSaleCount > 2`) | Done |
| 1.1 Bred-on-PetOS ribbon + lineage on listing | `BredOnPetosRibbon.tsx`, `LineageTree.tsx` | Done |
| 1.1 Ownership transfer on accept | `tg_apply_ownership_transfer` trigger + `TransferSheet` | Done |
| 1.2 `/mates` split: Find mate vs Adopt/Buy | `Mates.tsx` two-tab UI | Done |
| 1.2 Stud / for-sale toggles on pet profile | `PetProfile.tsx` owner controls (Phase B) | Done |
| 1.2 Litter creation flow | `NewLitter.tsx` + `litter_groups` + `tg_listing_auto_bred` | Done |
| 1.2 Litters tab on breeder profile | `LittersList.tsx` on UserProfile + OrgProfile (Phase C) | Done |
| 2 Cover photo + 3-zone profile + pet rail + tabs | `Profile.tsx`, `UserProfile.tsx` (5/6-col tabs) | Done |
| 2 Pet mini-profile (IG-style) | `PetProfile.tsx` (cover, stats, lineage/health/achievements tabs) | Done |
| 2 Tagged tab via collabs | `PostGrid collabsOnly` | Done |
| 3a Pet Parent badge + flow | `SellerBadge.tsx` | Done |
| 3b Breeder verification + green tick | `org_profiles.status='approved'` + `useVerifiedOrgs` (Phase A) | Done |
| 3b Litter management + bulk linking | `NewLitter.tsx`, `litter_pets` | Done |
| 3b Customer reviews on breeder profile | `set_verified_purchase` trigger exists for `subject_type='pet_partner'` but no UI | **Gap** |
| 3c Kennel org page + boarding services | `OrgProfile.tsx` + `BoardingList` (Phase C) | Done |
| 3d Shelter donate (UPI deep link) | `OrgProfile.tsx` donate card | Done |
| 3d Adoption applications instead of sale | `adoption_applications` + `AdoptionApplicationSheet` + `/adoption-inbox` (Phase D) | Done |
| 3d Volunteer CTA | `OrgProfile.tsx` volunteer button (Phase D) | Done |
| 3d Shelters near you rail | `SheltersNearYouRail` on Home (Phase D) | Done |
| 3e Zoo: no listings allowed | `tg_listing_compliance` blocks zoo listings | Done |
| 3e Zoo: symbolic adopt / donate flow | No UI yet | **Gap** |
| Feed differentiation (badge color + warning chip) | `SellerBadge`, `AdoptGrid` ribbon, repeat-seller chip | Done |

## What is actually left (only two items)

1. **Reviews after a real transaction** — the `reviews` table + `set_verified_purchase` trigger already exist in the DB. There is no UI to create or view a review tied to an `ownership_transfer` or a `mating_request` reaching `agreed`. Without this, breeder/shelter trust never compounds beyond the verified tick.
2. **Zoo symbolic adoption** — Zoos can't sell pets, so their `OrgProfile` currently looks empty for them. They need a "Symbolically adopt an animal" donation flow (styled donation card + UPI / external link), framed as sponsorship, not adoption.

Everything else from your walkthrough is already in production.

## Phase E — close the loop (single phase, no overlap with A–D)

### E1. Reviews wired to real events

- After `ownership_transfers.status` flips to `accepted`, surface a one-tap "Leave a review" CTA on the buyer's notifications and on the listing detail (only visible to the buyer, only once).
- Reuse the existing `reviews` table with `subject_type='provider'` for the seller's user_id (or `subject_type='pet_partner'` when a `mating_requests` row hits `agreed`).
- Render the review list on the seller's `OrgProfile` and `UserProfile` (new "Reviews" tab for breeder / kennel / shelter; one section under the donate card for shelters).
- Show the green "Verified purchase" pill when `verified_purchase=true` (the trigger already sets this).
- Aggregate average score + count next to the SellerBadge so feed cards inherit it.

```text
ownership_transfers.accepted ──► notify buyer "Rate the breeder"
mating_requests.agreed       ──► notify both owners "Rate this pairing"
                                       │
                                       ▼
                               reviews row created
                                       │
                                       ▼
            UserProfile / OrgProfile "Reviews" tab + avg-rating chip on cards
```

### E2. Zoo profile completion

- Detect `org_type='zoo'` on `OrgProfile` and switch the page into "info + sponsor" mode: facility photos, mission, education blurb, no listings grid.
- Add a "Symbolically adopt an animal" card. Reuses the same UPI / `donation_url` fields zoos already fill during onboarding; copy explicitly says it's a sponsorship / donation, not a real ownership transfer.
- If a zoo has no donation channel set up, show the owner an inline prompt to fill it in (only when viewer is the org owner).

### Acceptance check after Phase E

- A buyer who completes a transfer sees a review prompt and the resulting review on the breeder's profile within seconds.
- A breeder profile shows aggregated rating + verified-purchase chips on individual reviews.
- A zoo profile shows a styled sponsorship card with UPI deep link, and no sale listings appear under it.

## Out of scope (already done or intentionally deferred)

- Reels tab — explicitly "future" in the walkthrough.
- Staff accounts for kennels — explicitly "(future)" in the walkthrough.
- Auto-flag backyard breeders beyond the existing 3+ active listings rule.

After E1 + E2 the walkthrough is fully closed.
