# PetOS — Final Gap Audit & Closing Plan

I re-checked the live source against the original PDF audit. Below is what is **actually** built today vs. what still needs to ship. I cross-referenced every claim from the audit with `rg` against `src/` so this is grounded, not from memory.

---

## What is now ✅ DONE since the audit (Rounds 21–24)

| Original gap | Status now | Where |
|---|---|---|
| Skill Spotlight system (ribbon, Vouch, Skills tab, Crowd-fav ≥50, 🤯 reaction) | ✅ Done | `skills/SkillsTab`, `skills/VouchButton`, `skills/SkillSpotlightRibbon`, `posts.skill_spotlight_id`, `ReactionBar` 🤯 |
| Rescue Journey ribbon + Day-N timeline | ✅ Done | `rescue/RescueJourneyRibbon`, `rescue/RescueJourneyCarousel`, `rescue/RescueJourneyPicker`, `/rescue/:id`, trigger auto-fills Day-N |
| Bred-on-PetOS ribbon on listings + lineage | ✅ Done | `BredOnPetosRibbon` placed in `AdoptGrid` + `AdoptListingDetail` with `PedigreeSheet` |
| Streak chip on multiple surfaces | ✅ Done | `UserStreakChip` in `PostFeed`, `CommentSheet`, `MessageThread` |
| Vet ↔ Health-vault in-call handoff | ✅ Done | `AppointmentRoom.tsx` calls `vet-grant-create`, owner sees code, vet has code-entry to `/v/:code` |
| Health-test chip on listings | ✅ Done | `HealthTestChip`, `HealthTestPicker`, `pet_listings.health_tests` jsonb |
| Banner tint per role | ✅ Done | `UserProfile.tsx` applies `getRoleBanner(accountType)` |
| Buyer "What I'm looking for" card | ✅ Done | `UserProfile.tsx:209` renders chips for species/breed/city/budget |

---

## What is still ❌ / ⚠️ open

I narrowed the original 7-item list down to what truly hasn't shipped, plus a handful of small spot-fixes from the ⚠️ rows:

### A. Rescuer trust + caps (the only fully-untouched round)

- ❌ "Pending verification" chip on `SellerBadge` for rescuer with submitted/review org KYC
- ❌ Block on `AdoptListingNew` for unverified rescuers — must co-list with an approved shelter
- ❌ "Co-listed with [Shelter ✓]" subline on listing card + detail (`pet_listings.co_listed_with_org_id`)
- ❌ Soft warning bubble in `MessageThread` when an unverified rescuer is asked for/sends payment intent (UPI / ₹ regex)

### B. Surface polish (small, scattered ⚠️ items)

- ❌ "Available for Mating" badge on pet rail / `PetProfile` header (data exists in `mate_listings`, just not surfaced)
- ❌ Buyer's target-breed chip on search results card
- ❌ Auto "Educational" tag on every zoo composer post
- ⚠️ "Helpful vet" badge inlined next to vet's role chip on every surface (today only on achievements rail)
- ⚠️ Spot-check: every feed/comment/message query filters by `useBlockedIds` (cross-cutting trust)

### C. Notifications follow-up

- ❌ Skill-Spotlight vouch notification with skill icon overlay — emits a row when someone vouches; surfaces in bell

---

## Prioritized rollout (3 rounds, no overlap)

Ordering principle: **biggest trust gap first, then surface polish, then notification glue.** Each round is self-contained and edits a disjoint set of files.

```text
Round 25  →  Round 26  →  Round 27
(trust)      (polish)     (notifs)
 1 day       0.5 day      0.5 day
 1 mig       0 mig        1 mig
```

### Round 25 — Rescuer caps & trust (1 day · 1 migration)

✅ **DONE** — Migration shipped (`pet_listings.co_listed_with_org_id`, BEFORE-INSERT trigger `enforce_rescuer_colist`). New `<CoListShelterPicker>` is wired into `AdoptListingNew` and is mandatory when the author is an unverified rescuer. `<SellerBadge>` now accepts a `pending` prop and renders "KYC pending". `<AdoptGrid>` shows "Co-listed with [Shelter] ✓" subline. `<AdoptListingDetail>` shows a leaf info card + passes `pending` to SellerBadge for unverified rescuers. `<MessageThread>` injects a one-time amber soft-warning bubble when the other party is an unverified rescuer and any message in the thread mentions ₹/INR/UPI/GPay/Paytm/PayPal; dismissal persists in `localStorage` per-thread.

**Migration**
- `pet_listings`: add `co_listed_with_org_id uuid references org_profiles(id)` (nullable).
- Trigger on `pet_listings INSERT`: if author's role is `rescuer` AND author has no `approved` org, then `co_listed_with_org_id` is REQUIRED and must reference an `approved` shelter org. Reject otherwise.

**Frontend**
- `SellerBadge.tsx`: add a `pending` ghost-chip (amber outline, "KYC pending") when role is rescuer and `org_profiles.status` ∈ `submitted` / `review`.
- `AdoptListingNew.tsx`: if user is unverified rescuer, render a mandatory "Co-list with shelter" picker (search approved shelters); block submit otherwise. If user is a verified org, picker is hidden.
- `AdoptGrid.tsx` + `AdoptListingDetail.tsx`: render "Co-listed with [Shelter ✓]" subline when `co_listed_with_org_id` is set (with KYC tick on the shelter name).
- `MessageThread.tsx`: when the other party is an unverified rescuer AND a message body matches `/(₹|rs\.?|inr|upi|gpay|paytm|paypal)/i`, inject a one-time soft warning bubble: *"Heads-up: this account isn't verified yet. Avoid sending money outside Petos."* Stored in `localStorage` per-thread so it only shows once.

**Verify**
- Sign in as rescuer with no org → `AdoptListingNew` forces the picker; submitting without one is blocked.
- That rescuer's listing in grid shows "Co-listed with Happy Tails ✓".
- Send "I'll UPI you ₹500" → warning bubble appears once.

---

### Round 26 — Surface polish (0.5 day · no migration)

✅ **DONE** — `<MateAvailableBadge>` (queries `mating_listings`) added to PetProfile header. New `useHelpfulVetIds` hook + "Helpful" pill on `AuthorIdentity` for vets with ≥1 helpful answer. Buyer's "Looking for: {breed}" chip added to Search PeopleList (bulk fetch). `Composer` auto-appends `#educational` for zoo accounts and shows an "Auto: #educational" preview chip. Blocked-id filtering added to `CommentSheet`, `useNotifications`, and the `Messages` conversation list (1:1 threads with blocked users are hidden).

- `PetProfile.tsx` header: small amber pill "Available for Mating" when `mate_listings` has an active row for the pet. Tap → `/mates/:listingId`.
- `Profile.tsx` pet rail: same pill on each pet thumbnail (tiny corner dot).
- `SearchResults` card (or wherever buyer profile cards render): if author role is `buyer` and `looking_for.breed` is set, show a small chip "Looking for: Labrador" under the name.
- `Composer.tsx`: when author primary role is `zoo`, auto-add hashtag `#educational` to the post and lock-in a small "Educational" chip preview before submit.
- `AuthorIdentity.tsx`: when target user has the `helpful_vet` achievement AND role is `vet`, render a tiny green ribbon icon next to the role chip (one extra `useQuery` for achievement, cached).
- Sweep all data fetches for blocked-id filtering: `posts`, `comments`, `messages`, `notifications`, `vet_questions`. Add `.not('author_id', 'in', '(${blockedIds.join(',')})')` where missing. Spot-check via grep, fix only the misses.

---

### Round 27 — Vouch notification (0.5 day · 1 migration)

Closes gap **C**.

**Migration**
- Trigger on `skill_vouches AFTER INSERT`: insert a `notifications` row with `kind='skill_vouch'`, `actor_id=voucher_id`, `subject_type='skill_spotlight'`, `subject_id=spotlight_id`, addressed to the pet owner.

**Frontend**
- `Notifications.tsx`: handle `kind='skill_vouch'` — render the actor via `AuthorIdentity` with a tiny orange `Sparkles` overlay on the avatar; copy: *"vouched for {petName}'s {skillName}"*. Tap navigates to `/pet/:publicId?tab=skills`.

**Verify**
- User A vouches User B's pet → bell icon on User B updates in realtime; row shows actor + skill icon overlay.

---

## Round summary

| Round | Scope | Time | Migrations | Closes |
|---|---|---|---|---|
| 25 | Rescuer caps & trust | 1 day | 1 | Gap A (4 items) |
| 26 | Surface polish | 0.5 day | 0 | Gap B (5 items) |
| 27 | Vouch notification | 0.5 day | 1 | Gap C (1 item) |
| **Total** | | **2 days** | **2** | **10 items** |

After Round 27, every ❌ from the original PDF audit is closed. The only remaining ⚠️ items are subjective ("verify exact stats on BreederHome") and can be handled inline as visual QA, not as a build round.

---

## Technical notes

- No round touches the same file as another — `Round 25` edits `SellerBadge`, `AdoptListingNew`, `AdoptGrid`, `AdoptListingDetail`, `MessageThread`; `Round 26` edits `PetProfile`, `Profile`, `Composer`, `AuthorIdentity`, search/feed query files; `Round 27` edits `Notifications.tsx` and adds one DB trigger. Zero overlap.
- The rescuer trigger uses `SECURITY DEFINER` so it can read `org_profiles.status` regardless of viewer.
- The `co_listed_with_org_id` lookup in `AdoptListingNew` uses an existing `org_profiles` public-read RPC; no new endpoint.
- The blocked-id sweep is a non-breaking additive filter; missing it today silently leaks blocked authors into feeds.

Reply **`go round 25`** to start, or tell me to reorder / skip a round.
