# Mates → Two sub-tabs: Mating + Adopt / Rehome

## Goal
Keep `/mates` as the home for "pet-to-pet life events," but cleanly separate two very different intents so users (and trust signals) don't get mixed up:

1. **Mating** — current flow (stud / dam, vaccination-verified, agreements). No change in behavior.
2. **Adopt / Rehome / Breeder sale** — a new, safety-first listing flow.

## Why a sub-tab (not Discover, not a new top tab)
- One mental home for "I'm looking for another pet's owner."
- Discover stays focused on services, shop, meetups, exploration.
- Avoids adding a 6th bottom-nav slot (5 is already optimal).

## UX layout

```text
/mates
 ├── Header: "Find your pet's perfect match"
 ├── Your-pet hero card (unchanged)
 ├── Segmented control:  [ Mating ]  [ Adopt & Rehome ]
 │      ↑ sticky, swipeable
 └── Grid below changes per tab
```

- Default tab = **Mating** (preserves current behavior).
- Contextual FAB on `/mates` already navigates to `/mates/new`. We extend it: long-press or a small chevron opens a chooser — "List for mating" vs "List for adoption / rehome".
- URL state via `?tab=mating|adopt` so back-button and deep links work.

## Adopt / Rehome — listing types

Three listing types, picked at creation time:

| Type | Who | Fee allowed | Required proofs |
|---|---|---|---|
| **Adoption** | Anyone rehoming a rescue / personal pet | Free only | Vax record, dewormer, age ≥ 8 weeks |
| **Rehoming** | Owner who can no longer keep pet | Token fee (₹0–₹2,000) | Vax record, reason, ownership proof |
| **Breeder sale** | Verified breeders only | Any fee | Breeder cert upload + KYC + parents' info + microchip |

### Mandatory guardrails for every adopt listing
- Vaccination record upload (image)
- Age field — block puppies/kittens under 8 weeks
- City + approximate location (no exact address publicly)
- Phone verified (already part of profile)
- "No in-app payment for the pet itself." Listings show fee transparently; transfer happens in person.
- Optional refundable visit-deposit (₹500) via existing payment_intents flow — protects sellers from no-shows, refundable if either party cancels.

### Breeder verification (one-time)
- Upload breeder registration certificate (state Animal Welfare Board / Kennel Club India number).
- Manual moderation queue → flips a `breeder_verified` flag on the user.
- Only verified breeders see "Breeder sale" as a listing option.

### Buyer-side trust signals on each card
- Vax-verified badge (existing pattern)
- Listing type badge: green "Adoption" / amber "Rehoming" / blue "Breeder ✓"
- Age, parents (if breeder), microchip indicator
- Report button (existing `ReportButton`)

### Anti-abuse
- Same seller > 2 active "breeder sale" listings in 30 days → flag for moderation
- Auto-takedown if reported by 3+ users until reviewed
- Cool-off interstitial before contacting seller: "A pet is a 10–15 year commitment. Continue?"

## Data model

New table `pet_listings` (separate from `mating_listings` to keep mating untouched):

```text
pet_listings
  id, owner_id, pet_id (nullable for rescues without a pet record)
  listing_type   enum: 'adoption' | 'rehoming' | 'breeder_sale'
  fee_inr        int nullable
  city, lat, lng
  age_weeks      int  (>= 8 enforced by trigger)
  vaccination_doc_url  text not null
  breeder_cert_url     text nullable
  parents_info         jsonb nullable   (sire/dam names, breed)
  microchip_id         text nullable
  description          text
  active               bool default true
  status               enum: 'active' | 'pending_review' | 'taken_down' | 'completed'
  created_at, updated_at
```

Plus:
- `profiles.breeder_verified  bool default false`
- `profiles.breeder_cert_url  text`
- RLS: anyone can SELECT active rows; owner can INSERT/UPDATE/DELETE own rows; only `breeder_verified=true` users can insert with `listing_type='breeder_sale'` (enforced via trigger + policy).

## Routes & files

New:
- `src/components/AdoptGrid.tsx` — grid of `pet_listings`, filters (type, species, city, age range)
- `src/pages/AdoptListingNew.tsx` — `/mates/adopt/new` 3-step form (type → pet info → proofs)
- `src/pages/AdoptListingDetail.tsx` — `/mates/adopt/:id`
- `src/components/AdoptListingCard.tsx`
- `src/components/CommitmentInterstitial.tsx` — cool-off dialog before "Contact seller"
- `src/pages/settings/BreederVerification.tsx` — upload cert, status badge

Updated:
- `src/pages/Mates.tsx` — add segmented `[Mating | Adopt & Rehome]` with `?tab=` URL sync; mount `MatesGrid` or `AdoptGrid`.
- `src/components/ContextualFab.tsx` — on `/mates?tab=adopt`, FAB navigates to `/mates/adopt/new`.
- `src/App.tsx` — new routes.

## Out of scope (later)
- In-app payment for the pet (intentionally excluded)
- Shipping / inter-city transport
- Breed-specific marketplaces

## Open question
You started typing "where the different peo…" — please finish that thought before we build, in case it changes the buyer/seller flow. Best guesses:
- "where different people can sell" → covered by listing types above
- "where different people meet" → handled by existing Meetups in Discover
- something else → tell me and I'll fold it in

---
Approve and I'll implement: migration → RLS → pages → segmented Mates tab → FAB wiring.
