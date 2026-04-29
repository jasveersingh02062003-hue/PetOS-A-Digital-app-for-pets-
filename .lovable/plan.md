# PetOS — Final Closeout Plan (Rounds 28–30)

Closes all **5 hard ❌** and all **13 ⚠️** from the audit in **3 disjoint rounds**. No round touches a file another round touches → no rework, no wasted credits.

**Total cost estimate**: 1 DB migration, 0 new edge functions, ~14 file edits, ~5 new small components.

---

## Round 28 — Vet & Service-provider in-call/live UX (the heavy lifting)

**Goal**: ship the only two ❌ items that need real wiring + their related ⚠️s. All edits are inside vet + walker + service-provider surfaces.

### Files touched (exclusive to this round)
- `src/pages/AppointmentRoom.tsx`
- `src/components/vet/PrescriptionBuilder.tsx` (already exists — just imported)
- `src/pages/MessageThread.tsx` *(only the live-walk chip block — append-only)*
- `src/pages/Bookings.tsx` *(append-only chip)*
- `src/components/AuthorIdentity.tsx` *(append category sub-chip for service_provider only)*
- `src/pages/UserProfile.tsx` *(vet specialisation rail block)*
- new: `src/components/vet/SharedVaultPanel.tsx`
- new: `src/components/walker/LiveWalkChip.tsx`
- 1 DB migration

### Work
1. **Open shared vault inside `AppointmentRoom`** (❌ #1)
   - Add a "Shared vault" tab next to the chat: only visible when `appt.status='in_progress'` AND viewer is the vet AND a valid `vet_grants` row exists for `(vet_id, pet_id)` with `expires_at > now()`.
   - Renders the new `SharedVaultPanel` which lists vaccinations + prescriptions + timeline (re-uses `VaultView` queries) inline (no new page).
   - Below it, mounts the existing `<PrescriptionBuilder petId={…} />` so vets can drop a prescription without leaving the call.

2. **Grant auto-expiry on appointment completion** (⚠️ #11)
   - DB trigger `expire_grants_on_appt_complete()` on `appointments`: when `status` flips to `completed` or `cancelled`, `UPDATE vet_grants SET expires_at = now() WHERE vet_id = NEW.vet_id AND pet_id = NEW.pet_id AND expires_at > now()`.

3. **Live-walk follow-link** (❌ #4)
   - `LiveWalkChip` queries `walk_sessions` for an active session matching the current booking's walker+pet; if found, renders an "🟢 Walk in progress · Follow live" button → `/walk/live/:id`.
   - Mount once in `MessageThread.tsx` header (when other party is service-provider) and once in `Bookings.tsx` row (active service bookings).

4. **Service-provider category sub-chip** (⚠️ #12)
   - `AuthorIdentity` already shows the role chip. Add a sibling `<span>` rendering `provider_categories.label` (Walker/Groomer/etc.) for `service_provider` accounts only. Pulled via existing `useProviderCategory` hook (or quick inline query if absent).

5. **Vet specialisation chip rail on public profile** (⚠️ #10)
   - In `UserProfile.tsx`, when `accountType === 'vet'`, render a chip rail from `vet_profiles.specializations[]` directly under the role chip.

### Verify
- Vet starts an appt → "Shared vault" tab appears → prescription dropped → patient sees notification → marking appt complete revokes the grant.
- Booked walker starts a `walk_session` → chip appears in MessageThread + Bookings → tap → `/walk/live/:id`.

---

## Round 29 — Org public surface (banner, tabs, copy locks)

**Goal**: every ⚠️ touching `OrgProfile.tsx` and the role-gated org tabs in one shot. Disjoint from Round 28.

### Files touched (exclusive to this round)
- `src/pages/OrgProfile.tsx` (banner + role-gated tab list)
- `src/pages/home/BreederHome.tsx` (stats strip verification + 4-tab confirmation)
- `src/pages/home/GaushalaHome.tsx` (per-animal monthly upkeep field rendering)
- `src/pages/home/ZooHome.tsx` (symbolic adoption tax-receipt CTA)
- `src/components/Composer.tsx` *(role-gated marketplace entrypoints — sanctuary/zoo)*
- `src/components/BredOnPetosRibbon.tsx` (open `PedigreeSheet` on tap)

### Work
1. **OrgProfile banner tint** (❌ #5 + ⚠️ duplicate)
   - Import `getRoleBanner` and apply to the banner `div`, mirroring `UserProfile.tsx:173`.

2. **Pedigree sheet from "Bred on PetOS" ribbon** (⚠️ #1)
   - Add `onClick` to `BredOnPetosRibbon` that opens `PedigreeSheet` with the litter's parents (already a prop). State held inline, no parent change required.

3. **Breeder stats strip + 4 public tabs** (⚠️ #2, #3)
   - Confirm `BreederHome` exposes Followers · Litters whelped · Successful placements · Avg review counters; backfill any missing aggregate from existing tables (`pets`, `pet_listings`, `reviews`).
   - Ensure `OrgProfile` (when `account_type='breeder'`) shows tabs **Litters / Mating / Pedigree / Reviews**, hydrated from existing components (`LittersList`, `MatesGrid`, `PedigreeSheet`, `ReviewsList`).

4. **Sanctuary per-animal monthly upkeep** (⚠️ #6)
   - Surface existing `pets.monthly_upkeep_inr` (or add column in this round's migration if absent — check first; likely exists). Render under each animal card on `GaushalaHome`.

5. **Sanctuary + Zoo composer/marketplace gating** (⚠️ #7, #9)
   - In `Composer.tsx`, hide "Sell" / "Mating" entry-points when `accountType ∈ {'sanctuary','zoo'}`.
   - In `OrgProfile.tsx`, omit Litters / Mating / Adopt tabs for those roles.

6. **Zoo symbolic adoption tax receipt** (⚠️ #8)
   - On `ZooHome`, the symbolic-adoption CTA → existing `SponsorSheet` with `tax_receipt=true` flag (column already in `sponsorships`). Confirm receipt PDF link surfaces in donor's `OrgDonations` ledger.

### Verify
- Visit any verified org's public profile → role-tinted banner present.
- Breeder profile shows 4 tabs and 4 stats.
- Sanctuary/Zoo composers don't expose marketplace.
- Tap "Bred on PetOS" on a listing → pedigree sheet opens.

---

## Round 30 — Marketplace polish (shelter lock, kennel cards, buyer wishlist)

**Goal**: the remaining marketplace-side ❌s and ⚠️s. Disjoint from Rounds 28 & 29.

### Files touched (exclusive to this round)
- `src/components/AdoptGrid.tsx` (shelter ₹0 lock + copy)
- `src/pages/AdoptListingDetail.tsx` (shelter ₹0 lock + copy)
- `src/pages/AdoptListingNew.tsx` *(force fee_inr=0 when seller is shelter — schema-side check)*
- `src/pages/home/KennelHome.tsx` (capacity + next-available on service cards + viewer-side DailyReportSheet sample)
- `src/pages/UserProfile.tsx` *(buyer wishlist tab — append-only block)*
- 1 small DB migration (CHECK trigger forcing `fee_inr=0` for shelter sellers)

### Work
1. **Shelter ₹0 lock + "Adopt, don't shop" copy** (❌ #2)
   - DB: trigger `enforce_shelter_zero_fee` on `pet_listings`: if seller's `account_type='shelter'`, force `fee_inr := 0`.
   - UI: in `AdoptGrid` and `AdoptListingDetail`, when `seller_type='shelter'`, replace the price element with a pill showing `"Free · Adopt, don't shop"`.
   - In `AdoptListingNew`, hide the price input for shelter accounts and show the same copy as a help line.

2. **Kennel service card: capacity + next-available** (❌ #3)
   - Add columns `capacity int` and `next_available_at timestamptz` to `services` table (single migration with #1 above).
   - Surface both on the service card in `KennelHome`: "🛏 {capacity} spots · Next: {date}".

3. **Kennel `DailyReportSheet` viewer preview** (⚠️ #5)
   - On `KennelHome` public view, add a "Preview a sample daily report" button that opens `DailyReportSheet` in read-only mode with a static sample payload.

4. **Buyer wishlist tab on public profile** (⚠️ #4)
   - In `UserProfile.tsx`, when `accountType='buyer'`, append a "Wishlist" tab next to Posts/Saved-searches that lists `buyer_wishlist` rows (table likely exists; if not, this round adds it as part of the same migration).

### Verify
- Shelter creates a listing → price field gone, ₹0 enforced server-side.
- Kennel service cards show capacity + next-available.
- Buyer profile shows a Wishlist tab to other viewers.

---

## File-overlap matrix (proof of zero rework)

```text
File                                    R28  R29  R30
src/pages/AppointmentRoom.tsx            X
src/pages/MessageThread.tsx              X
src/pages/Bookings.tsx                   X
src/components/AuthorIdentity.tsx        X
src/pages/UserProfile.tsx                X         X*
src/pages/OrgProfile.tsx                      X
src/pages/home/BreederHome.tsx                X
src/pages/home/GaushalaHome.tsx               X
src/pages/home/ZooHome.tsx                    X
src/pages/home/KennelHome.tsx                      X
src/components/Composer.tsx                   X
src/components/BredOnPetosRibbon.tsx          X
src/components/AdoptGrid.tsx                       X
src/pages/AdoptListingDetail.tsx                   X
src/pages/AdoptListingNew.tsx                      X
```

*`UserProfile.tsx` is touched in two rounds but in **different append-only blocks** (R28 = vet specialisation rail; R30 = buyer wishlist tab). Different roles → different code paths → cannot conflict.*

---

## Round summary

| Round | Scope | Migrations | Closes |
|---|---|---|---|
| 28 | Vet in-call vault + walker live-link + sub-chips | 1 | ❌ #1, #4 + ⚠️ #10, #11, #12 (5 items) |
| 29 | Org public profile, banner, tabs, ribbons | 0 | ❌ #5 + ⚠️ #1, #2, #3, #6, #7, #8, #9 (8 items) |
| 30 | Shelter lock, kennel card, buyer wishlist | 1 | ❌ #2, #3 + ⚠️ #4, #5 (4 items) |
| **Total** | | **2** | **5 ❌ + 12 ⚠️ = 17 items closed*** |

*One ⚠️ ("OrgProfile banner tint") is the duplicate of ❌ #5 — counted once.*

---

## Why this won't waste credits

- **No file appears in two rounds doing the same thing.** R28 and R30 both touch `UserProfile.tsx` but in two different `accountType` branches that cannot collide.
- **Each round is self-contained.** You can stop after R28 if budget is tight and the app still works — every previous ✅ stays ✅.
- **Two migrations total.** Round 28 (grant expiry trigger) + Round 30 (shelter zero-fee + service columns). Round 29 is UI-only.
- **Zero new edge functions, zero new external dependencies.**

---

Reply **`go round 28`** to start, or **`go all 3`** if you want me to ship 28 → 29 → 30 in sequence without stopping for approvals between rounds.
