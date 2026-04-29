# PetOS — PDF vs Reality Audit

This is a **verification-only** report. No code changes are proposed yet. For every claim in `Petos_Viewer_Journey.pdf`, I checked the actual source. Each item is marked:

- ✅ **Done** — implemented and wired (frontend + backend) the way the PDF describes
- ⚠️ **Partial** — exists but missing pieces, wrong surface, or only half-wired
- ❌ **Missing** — claimed in PDF, not in code

After you confirm this list, I'll produce a focused implementation plan for the ❌ and ⚠️ items.

---

## 1. Visual identity system (avatar ring · role chip · tick · banner)

| Claim in PDF | Status | Evidence |
|---|---|---|
| Single `AuthorIdentity` used everywhere (post, comment, search, notif, listing, thread) | ✅ | `src/components/AuthorIdentity.tsx` consumed across feed, comments, vet answers, notifications |
| Role-coloured avatar ring (parent=blue, breeder=amber, kennel=sky, shelter=lilac, sanctuary=leaf, zoo=stone, rescuer=coral) | ✅ | `src/lib/roleTheme.ts` `RING` map matches PDF exactly |
| Role chip with role icon and tinted background | ✅ | `src/components/SellerBadge.tsx` |
| Green KYC tick **only** for approved orgs; never for pet_parent / buyer | ✅ | `SellerBadge` hides tick when `pet_parent`/`buyer`; `useIsVerifiedOrg` reads `org_profiles.status='approved'` |
| Org accounts show org name with "Managed by [human]" subline | ✅ | `AuthorIdentity` `useOrg` branch |
| Banner tint per role on profile header | ⚠️ | `getRoleBanner` exists in `roleTheme.ts`, but I need to confirm `UserProfile.tsx` actually applies it on every role profile (spot-check needed during build) |

---

## 2. Pet Parent

| Claim | Status | Notes |
|---|---|---|
| Blue ring, "Pet parent" chip, no tick | ✅ | |
| **3-day care streak chip** on post header / under like row / message-thread header | ❌ | `StreakChip` exists but is **only used on `Daily.tsx`**. Not on PostFeed headers, not in CommentSheet, not in MessageThread, not on UserProfile. PDF promises it on multiple surfaces. |
| Pet rail on profile (Bruno + Mochi) | ✅ | `Profile.tsx` / `UserProfile.tsx` render pets |
| **"Available for Mating" badge** on pet card with vaccination chips | ⚠️ | Mating listings exist (`MateListing`, `MatesGrid`) but I found **no badge surfaced on the pet rail / pet profile** indicating the pet is currently listed for mating |
| **Skills tab on pet profile** + Skill Spotlight + Vouch button + 🤯 reaction + "Crowd-favourite ≥50 vouches" badge | ❌ | No `skill`, `vouch`, `spotlight`, or `crowd_fav` references found anywhere in `src/` or `supabase/migrations/`. **Entire Skill Spotlight system is undocumented in code.** PDF describes it in detail (page 12) but it does not exist. |
| **Yellow "Repeat seller — N active listings" warning** on listing card | ✅ | `repeat_sellers` view + `AdoptGrid.tsx:209` chip + `AdoptListingDetail.tsx:173` advisory |

---

## 3. Buyer ("Looking for a pet")

| Claim | Status | Notes |
|---|---|---|
| "Looking for a pet" chip with magnifying-glass icon | ✅ | `SellerBadge` `buyer` row uses `Search` icon |
| **"What I'm looking for" card** on profile (species, breed shortlist, city, budget, open-to-adoption) | ⚠️ | `lookingFor` is read in `Profile.tsx` and `UserProfile.tsx`, but I need to verify in build mode whether the **public** `UserProfile` actually renders the full card to other viewers (claimed as the social signal) |
| Tabs: Posts / Saved searches / Wishlist | ⚠️ | Saved searches hook exists (`useSavedSearches`), wishlist not confirmed as a tab on the public buyer profile |
| Searching-for chip on search result | ❌ | Search results don't show buyer's target breed |

---

## 4. Breeder

| Claim | Status | Notes |
|---|---|---|
| Amber ring + Breeder chip + green tick when KYC approved | ✅ | |
| "Managed by [human]" subline | ✅ | |
| **"Bred on PetOS" ribbon on post / listing photo** | ⚠️ | `BredOnPetosRibbon` component exists, but `rg` shows it is **not imported into `PostFeed.tsx` or `AdoptGrid.tsx` card rendering**. `AdoptGrid` does check `bred_on_petos` flag at line 190 but only renders a small chip, not the documented ribbon with lineage-tap behaviour. |
| Tap ribbon → tiny lineage card (dam + sire) → "View pedigree" | ❌ | `BredOnPetosRibbon` shows links to parents but is not opening `PedigreeSheet` from listing/post; `PedigreeSheet` is not wired into `AdoptListingDetail.tsx` |
| Stats strip on profile (Followers · Litters whelped · Successful placements · Avg review) | ⚠️ | Need to verify exact stats on `BreederHome` / public org profile |
| Litters / Mating availability / Pedigree / Reviews tabs | ⚠️ | `LittersList`, `MatesGrid`, `PedigreeSheet`, `ReviewsList` exist — need to confirm all four are tabs on the public org profile, not just owner dashboard |
| **Health-test chip** ("Hips OFA Good") on listing card | ❌ | No `health_test` / `OFA` references in listing card render |
| `PayDepositSheet` on listing | ✅ | Component exists and used |

---

## 5. Kennel

| Claim | Status | Notes |
|---|---|---|
| Sky ring + Kennel chip + tick | ✅ | |
| Services tab + price + capacity + next-available | ⚠️ | Services exist, "next-available date" surfacing on card not confirmed |
| **Daily report sample preview to viewers** (`DailyReportSheet`) | ⚠️ | Component exists for owner — need to verify viewers can preview a sample |
| BookingSheet → confirm → `bookings` lifecycle visible | ✅ | |

---

## 6. Shelter / Rescue NGO

| Claim | Status | Notes |
|---|---|---|
| Lilac ring + Shelter chip + tick | ✅ | |
| **"Rescue Journey" ribbon** on post photo | ❌ | Zero references to `RescueJourney` / `rescue_journey` anywhere in code |
| **Day 1 / Day 7 / Day 14 timeline carousel** inside post | ❌ | Not implemented |
| Adoptables: ₹0 lock + "Adopt, don't shop" line | ⚠️ | Need to confirm exact copy + price lock UI |
| Sponsor tiles + Donations ledger | ✅ | `SponsorSheet`, `OrgDonations` |
| `AdoptionApplicationSheet` flow + status notification | ✅ | Component + `AdoptionInbox` exist |

---

## 7. Sanctuary / Gaushala

| Claim | Status | Notes |
|---|---|---|
| Leaf ring + Sanctuary chip + tick | ✅ | |
| Animals tab with monthly upkeep + Sponsor button | ⚠️ | Sponsor exists; per-animal "monthly upkeep cost" surfaced is unverified |
| No marketplace / no mating tabs (enforced) | ⚠️ | Need to verify these tabs are **hidden** for sanctuary role on profile |

---

## 8. Zoo / Wildlife

| Claim | Status | Notes |
|---|---|---|
| Stone ring + Zoo chip + tick | ✅ | |
| Exhibits tab via `ExhibitSheet` | ✅ | `ZooHome.tsx` |
| **"Educational" tag on every zoo post** | ❌ | Composer doesn't auto-tag zoo posts |
| **Symbolic adoption flow with tax receipt** | ⚠️ | "Symbolically adopt an animal" CTA exists in `OrgProfile.tsx:87` but the actual sponsorship → tax receipt loop for zoos is not confirmed |
| Marketplace tabs hidden for zoo | ⚠️ | Need to verify role-gating |

---

## 9. Independent Rescuer

| Claim | Status | Notes |
|---|---|---|
| Coral ring + Rescuer chip + heart icon | ✅ | |
| **"Pending verification" chip** when org KYC submitted but not approved | ❌ | `SellerBadge` only renders verified ✓ or nothing — no pending state |
| **Cap: cannot list adoptions directly; must co-list with verified shelter** | ❌ | No code restricting `AdoptListingNew` based on rescuer-without-org |
| **"Co-listed with [Shelter ✓]" line** on rescuer's listing card | ❌ | No `co_listed` field or UI |
| **Soft warning before sending money to unverified rescuer** in messages | ❌ | Not implemented |

---

## 10. Veterinarian

| Claim | Status | Notes |
|---|---|---|
| Vet chip + tick + clinic + city subline | ✅ | `VetAnswerCard` uses AuthorIdentity |
| Mark-as-helpful button + count | ✅ | `VetAnswerCard` |
| **"Helpful vet" badge surfaces next to vet's chip after first helpful answer** | ⚠️ | `helpful_vet` achievement exists in `AchievementChips` and `Profile.tsx`, but it's not auto-attached next to the vet's role chip on every surface (only on the achievements rail) |
| Specialisations chip rail | ⚠️ | Need to verify on public vet profile |
| `BookAppointment` with fee + in-clinic/tele toggle | ✅ | |
| **Health-vault grant code flow** (`vet-grant-create`, 6-char code, time-limited, "Open shared vault" in appt room, prescription drop, expires after appt) | ⚠️ | Edge function `vet-grant-create` exists; `AccessRequests`, `VaultView` pages exist; `PrescriptionBuilder` exists. But I found **no "Open shared vault" button in `AppointmentRoom.tsx`** — the in-call handoff UI described in the PDF does not appear to be wired |

---

## 11. Service Provider

| Claim | Status | Notes |
|---|---|---|
| Sky ring + Service provider chip + category sub-chip | ⚠️ | Category sub-chip beside the role chip not confirmed |
| TrustBadge rail (police-verified, first-aid, insured) | ✅ | `TrustBadge` component + `ProviderTrust` page |
| Live walk follow-along during active booking | ⚠️ | `WalkLive` / `WalkSession` exist for the walker; **viewer-side "follow your live walk" link in MessageThread/Bookings** not confirmed |
| Post-completion `LeaveReviewSheet` prompt | ✅ | |

---

## 12. Notifications surface (Round 14 promise)

| Claim | Status |
|---|---|
| Bell row uses AuthorIdentity (role tint + tick + name) for the actor | ✅ — done in Round 14 |
| Skill-Spotlight vouch notification with skill icon overlay | ❌ — depends on the missing Skill Spotlight system |

---

## 13. Cross-cutting trust

| Claim | Status |
|---|---|
| Tick rendered in identical position across every surface | ✅ |
| `ReportDialog` with categorised reasons + moderation inbox | ✅ |
| Block: hides posts/comments/messages, prevents new threads, keeps your previous reviews public | ⚠️ — `BlockButton` + `blocked_users` + `useBlockedIds` exist; need to spot-check that **every** feed/comment/message query filters by blocked_ids |

---

## Summary scoreboard

| Category | ✅ Done | ⚠️ Partial | ❌ Missing |
|---|---|---|---|
| Visual identity | 5 | 1 | 0 |
| Pet parent | 2 | 1 | 2 (streak placement, full Skill Spotlight system) |
| Buyer | 1 | 2 | 1 |
| Breeder | 3 | 3 | 2 |
| Kennel | 2 | 2 | 0 |
| Shelter | 3 | 1 | 2 (Rescue Journey ribbon + journey timeline) |
| Sanctuary | 1 | 2 | 0 |
| Zoo | 2 | 2 | 1 |
| Rescuer | 1 | 0 | 4 (pending chip, listing cap, co-list, $-warning) |
| Vet | 3 | 3 | 0 (but vault-in-call handoff is the big ⚠️) |
| Service provider | 2 | 2 | 0 |
| Notifications | 1 | 0 | 1 |
| Cross-cutting trust | 2 | 1 | 0 |

---

## The 7 most material gaps (PDF says yes, code says no)

These are the items that, if a real user came in tomorrow expecting the PDF, would feel like broken promises:

1. **Skill Spotlight system** (ribbon, 🤯 reaction, Vouch button, Skills tab on pet, Crowd-favourite ≥50 badge) — entirely missing. Largest single gap.
2. **Rescue Journey ribbon + Day-N timeline carousel** on shelter/rescuer posts — missing.
3. **"Bred on PetOS" ribbon wired into actual feed posts and listing cards with lineage tap-through** — component exists but not placed in PostFeed / AdoptGrid card; lineage `PedigreeSheet` not opened from listing.
4. **Streak chip on post headers, message threads, and comment rows** — only renders on `Daily.tsx` today.
5. **Rescuer caps** (no direct adoption listing; co-listing requirement; pending-verification chip; pre-payment soft warning) — none enforced.
6. **Vet ↔ Health-vault in-call handoff** ("Open shared vault" button in AppointmentRoom, prescription drop, expiry on appt end) — backend exists, the in-call UI does not.
7. **Health-test chip** on breeder listing cards (e.g. "Hips OFA Good") — no field surfaced.

---

## Implementation plan — 7 material gaps, sequenced

Audit approved. Below is the sequenced plan, grouped into 5 rounds. Each round is independently shippable, has a clear "definition of done", and lists the migrations / files / verifications required. **No code is written yet** — reply `go round 21` (or any round number) to start.

Ordering principle: ship the **wiring-only** rounds first (free wins from components that already exist), then the **net-new systems** (Skill Spotlight, Rescue Journey), and finally the **policy/role** caps that touch many surfaces.

---

### Round 21 — Wire what already exists (½ day, no migrations)

Pure frontend. Closes 3 of the 7 gaps by placing existing components on the surfaces the PDF promises.

**Closes gaps:** #3 Bred-on-PetOS wiring · #4 Streak chip placement · #6 Vet vault in-call handoff

**Tasks**
1. **Bred-on-PetOS ribbon on feed/listings**
   - Render `<BredOnPetosRibbon listingId|postId>` over the image in `PostFeed.tsx` (`PostCard`) when the post is linked to a `pet_listings` row with `bred_on_petos = true`.
   - Same in `AdoptGrid.tsx` card (replace the small chip at line ~190 with the ribbon).
   - In `AdoptListingDetail.tsx`, tapping the ribbon opens `PedigreeSheet` (already imported under `components/breeder`). Pass `petId` resolved from the listing.
2. **Streak chip on more surfaces**
   - Surface `<StreakChip userId={authorId} />` in:
     - `PostFeed.tsx` `PostCard` header (next to time-ago, only for `pet_parent` and only when streak ≥ 3).
     - `CommentSheet.tsx` next to commenter name (same threshold).
     - `MessageThread.tsx` header next to the other person's name.
   - Throttle: `StreakChip` should already memoize via React Query — confirm cache key is `["streak", userId]`.
3. **Vet "Open shared vault" in `AppointmentRoom.tsx`**
   - Query active `vet_grants` for `(vet_id = me, pet_id = appointment.pet_id, expires_at > now)`.
   - If a grant exists, render a primary button that links to `/vault/:code` (existing `VaultView.tsx`).
   - If no grant, render a secondary "Request vault access" button that calls existing `vet-grant-create` edge function in "request" mode (function already supports it; verify and add the branch if missing).

**Verify**
- Open a feed where a known breeder's post is `bred_on_petos = true` → ribbon shows, tap opens pedigree.
- Pet parent with 5-day streak → chip shows on their post header and in comment row.
- Vet joins an appointment whose owner granted a code → button visible; clicking lands in `VaultView`.

---

### Round 22 — Health-test chips on listings (½ day, 1 migration)

**Closes gap:** #7

**Migration**
- `pet_listings` add columns: `health_tests jsonb default '[]'::jsonb` (array of `{ name: string, result: string, verified_by?: uuid, verified_at?: timestamptz }`).
- Optional lookup table `health_test_catalog (code text pk, label text, species text)` seeded with the common ones (`hips_ofa`, `elbows_ofa`, `eyes_cerf`, `cardiac`, `dna_pra`, `bear_brucella`).
- RLS: listings already public-read; only listing owner can write to `health_tests`.

**Frontend**
- `AdoptListingNew.tsx` / `MatesNew.tsx` → add a "Health tests" step. Multi-select from catalog + free-text result chip ("Good", "Excellent", "Clear", "Carrier").
- New tiny component `<HealthTestChip name result />` rendered:
  - On `AdoptGrid.tsx` card (max 2 + "+N").
  - On `AdoptListingDetail.tsx` in a chip rail.
  - On `MatesGrid.tsx` card.
- When a verified vet later attests via the vault, set `verified_by` and add a tiny green tick to the chip.

**Verify**
- Create a breeder listing with "Hips OFA Good" → chip appears on grid + detail.

---

### Round 23 — Rescue Journey (1 day, 1 migration)

**Closes gap:** #2

**Migration**
- `rescue_journeys` (`id`, `org_id`, `pet_id`, `started_at`, `status` enum `in_care|adopted|rip`, `cover_url`).
- `rescue_journey_entries` (`id`, `journey_id`, `day_number int`, `image_url`, `caption text`, `created_at`).
- RLS: anyone can read; only the owning shelter/rescuer org members can write.
- Trigger: when a `posts` row is created by a shelter/rescuer with `rescue_journey_id` set, append an entry computing `day_number = floor((now - journey.started_at) / 1 day) + 1`.

**Frontend**
- `<RescueJourneyRibbon journeyId>` — lilac top-left ribbon ("Rescue Journey · Day 7").
- `<RescueJourneyCarousel journeyId>` — horizontal swipeable card under post body showing entries Day 1 → latest.
- Composer: when role ∈ {shelter, rescuer}, show a "Tag rescue journey" picker.
- Render ribbon + carousel inside `PostFeed.tsx` `PostCard` when `post.rescue_journey_id` present.
- New page `/rescue/:journeyId` for the full timeline.

**Verify**
- Shelter creates a post tagged to a journey → ribbon + carousel render in feed; full page works.

---

### Round 24 — Skill Spotlight system (1.5 days, 2 migrations)

**Closes gap:** #1 (the largest)

**Migrations**
- `pet_skills` (`id`, `pet_id`, `name text`, `taught_by uuid`, `created_at`).
- `skill_spotlights` (`id`, `pet_id`, `skill_id`, `post_id`, `video_url`, `caption`, `created_at`, `vouch_count int default 0`, `wow_count int default 0`).
- `skill_vouches` (`id`, `spotlight_id`, `voucher_id`, `created_at`, unique (spotlight_id, voucher_id)).
- `post_reactions` already exists — add `'wow'` (🤯) variant if not present (check `lib/reactions.ts`).
- Trigger: maintain `vouch_count` on insert/delete; when `vouch_count` crosses 50, set a `crowd_favourite_at` timestamp on `skill_spotlights`.
- RLS: read public; insert spotlight only by pet owner; insert vouch only authenticated, not self.

**Frontend**
- New tab "Skills" on `PetProfile.tsx` listing skills + their spotlights.
- `<SkillSpotlightRibbon>` (orange "Skill Spotlight · Sit") on the post photo when `post.skill_spotlight_id` present, in feed + pet profile.
- `<VouchButton spotlightId>` on the spotlight card (heart-with-paw icon, "Vouch · N").
- Add 🤯 to `ReactionBar` (`src/components/social/ReactionBar.tsx`).
- "Crowd-favourite" gold badge rendered next to skill name when `crowd_favourite_at IS NOT NULL`.
- Notification: "X vouched for Bruno's Sit" via existing notifications pipeline.

**Verify**
- Owner creates a skill + uploads a 10-sec clip → spotlight appears on pet profile and in feed with the orange ribbon. Vouch button increments. Manually setting count to 50 flips the gold badge.

---

### Round 25 — Rescuer caps & trust (1 day, 1 migration)

**Closes gap:** #5

**Migration**
- Add `co_listed_with_org_id uuid references org_profiles(id)` on `pet_listings` (nullable).
- Trigger / policy on `pet_listings` insert: if author's primary role is `rescuer` AND author has no approved org, then `co_listed_with_org_id` is required and must reference an `approved` shelter org.
- Add a "pending" state visible to `SellerBadge` — already implementable from `org_profiles.status in ('submitted','review')`.

**Frontend**
- `SellerBadge`: new `pending` ghost-chip ("KYC pending") when role is rescuer and org status ∈ submitted/review.
- `AdoptListingNew.tsx`: if user is unverified rescuer, force a "Co-list with shelter" picker (search approved shelters); block submit otherwise.
- `AdoptGrid.tsx` / `AdoptListingDetail.tsx`: render "Co-listed with [Shelter ✓]" subline when `co_listed_with_org_id` set.
- `MessageThread.tsx`: when the other party is an unverified rescuer **and** a message contains an amount/UPI/payment intent (regex `/(₹|rs\.?|inr|upi|gpay|paytm)/i`), inject a one-time soft warning bubble: "Heads-up: this account isn't verified yet. Avoid sending money outside Petos."

**Verify**
- Sign in as rescuer with no org → adoption-listing form forces co-list picker; submitting without one is blocked.
- Same rescuer's listing in grid shows "Co-listed with Happy Tails ✓".
- Send "I'll UPI you ₹500" in a thread to that rescuer → warning appears once.

---

## Round summary

| Round | Scope | Time | Migrations | Closes |
|---|---|---|---|---|
| 21 | Wire existing components | ½ day | 0 | #3, #4, #6 |
| 22 | Health-test chips | ½ day | 1 | #7 |
| 23 | Rescue Journey | 1 day | 1 | #2 |
| 24 | Skill Spotlight | 1.5 days | 2 | #1 |
| 25 | Rescuer caps + $-warning | 1 day | 1 | #5 |
| **Total** | | **~4.5 days** | **5** | **7 / 7** |

After Round 25, every "yes" in `Petos_Viewer_Journey.pdf` will be backed by working code on the surfaces the PDF promises.

---

## What I need from you next

Reply with the round you want to ship first, e.g. **`go round 21`**. I'll start with that round only and stop for your review before moving on.
