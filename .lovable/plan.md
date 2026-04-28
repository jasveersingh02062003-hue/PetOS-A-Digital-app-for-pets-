## Phase 1: Organizations, Lineage & Seller Identity

Build the full seller-identity, organization-onboarding, and "Bred on PetOS" lineage system on top of the existing Adopt & Rehome marketplace.

### 1. Database migration

**New enum**
- `account_type`: `pet_parent`, `breeder`, `kennel`, `shelter`, `sanctuary`, `zoo`, `rescuer`

**`profiles` additions**
- `account_type account_type not null default 'pet_parent'`
- `seller_type` snapshot (mirrors account_type for fast listing queries)

**New table `org_profiles`** (1:1 with profile for orgs)
- `user_id` (PK, FK profiles)
- `org_name`, `org_type` (account_type), `registration_no`, `registration_doc_url`
- `address`, `city`, `state`, `pincode`, `lat`, `lng`
- `phone`, `website`, `description`
- `facility_photos text[]`
- `donation_upi`, `donation_url` (shelters/sanctuaries/zoos)
- `status` (`pending` / `approved` / `rejected`), `reviewed_by`, `reviewed_at`, `rejection_reason`
- `created_at`, `updated_at`
- RLS: owner can read/insert/update own; everyone can read approved; admins/moderators can read+update all

**New table `litter_groups`**
- `id`, `sire_pet_id`, `dam_pet_id`, `birth_date`, `notes`, `created_by`, `created_at`
- RLS: creator can CRUD; everyone authenticated can read

**`pets` additions**
- `sire_pet_id uuid`, `dam_pet_id uuid`, `litter_id uuid` (FK litter_groups)

**`pet_listings` additions**
- `litter_id uuid`, `bred_on_petos boolean default false`
- `seller_type account_type` (snapshotted at insert)

**Triggers**
- `tg_listing_seller_snapshot` — copy `profiles.account_type` into `pet_listings.seller_type` on insert
- `tg_listing_zoo_block` — block any insert when seller_type = 'zoo'
- `tg_listing_shelter_free` — force `fee_inr = 0` and `listing_type = 'adoption'` for shelters/sanctuaries/rescuers
- `tg_listing_bred_on_petos` — set `bred_on_petos = true` when both sire+dam are linked PetOS pets
- `tg_org_approval` — when `org_profiles.status` flips to `approved`, also flip `profiles.breeder_verified = true` for breeders/kennels

**Storage**
- New public bucket `org-docs` for registration certificates and facility photos
- RLS: owner can upload to their own folder; everyone can read

### 2. Frontend components & pages

| File | Purpose |
|---|---|
| `src/pages/AccountTypeChooser.tsx` | First-run picker shown after signup: "I'm a pet parent / breeder / kennel / shelter / sanctuary / zoo / rescuer" |
| `src/pages/OrgOnboarding.tsx` | Multi-step KYC form. Fields & required docs vary by type (KCI no. for kennels, 80G/AWBI for shelters, etc.) |
| `src/pages/OrgProfile.tsx` | Public org page: photos, mission, donate CTA (UPI), volunteer CTA, listings rail |
| `src/components/SellerBadge.tsx` | Color-coded chip: Pet Parent (gray), Breeder (amber), Verified Breeder (green ✓), Kennel (blue), Shelter (purple), Sanctuary (teal), Rescuer (orange) |
| `src/components/BredOnPetosRibbon.tsx` | Ribbon on listing cards/detail showing sire+dam links to their PetOS profiles |
| `src/pages/admin/OrgReview.tsx` | Admin/moderator queue: pending org applications with doc preview + approve/reject |
| `src/components/OrgDiscoveryRails.tsx` | Home/Adopt rails: "Shelters near you", "Sanctuaries & Gaushalas" |
| `src/components/AdoptGrid.tsx` (edit) | Add seller-type filter chips |
| `src/pages/AdoptListingDetail.tsx` (edit) | Show SellerBadge + BredOnPetosRibbon; soft warning for repeat pet-parent sellers (>2 active sale listings) |
| `src/App.tsx` (edit) | Routes: `/onboarding/account-type`, `/onboarding/org`, `/org/:userId`, `/admin/orgs` |

### 3. Compliance behavior

- **Zoos**: profile + donate/volunteer only; DB blocks listings
- **Shelters/Sanctuaries/Rescuers**: only free adoption listings; DB enforces
- **Pet parents**: soft warning chip "Repeat seller" if >2 active sale listings; no hard block
- **Breeders/Kennels**: must be approved by admin before `breeder_sale` listings unlock

### 4. Out of scope (Phase 2)

Per-puppy litter UI, donation payment processing, AI-assisted document OCR, public org search page, volunteer request flow.

### Approval

Reply "approve" to run the migration and build all 9 components/pages above.
