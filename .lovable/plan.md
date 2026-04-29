# Final Round 31 — Close the last 3 gaps

After 30 rounds, the audit shows ~95% completion. This plan closes the final 3 items so we can publish.

## What's left

1. **❌ "Pending verification" chip on `SellerBadge`** — unverified orgs/rescuers should show a visible pending state instead of silently rendering as verified-looking.
2. **⚠️ `BredOnPetosRibbon` on PostFeed image overlay** — the ribbon renders on listing cards but not on feed post images for breeder-authored posts.
3. **⚠️ Kennel daily-report sample preview tile** — viewers visiting a kennel's public profile see no preview of what a daily report looks like.

## Changes

### 1. SellerBadge — Pending verification state
**File:** `src/components/SellerBadge.tsx`
- Add a `verified` prop (already passed in most call sites; default to checking the org/profile `verified_at` field).
- When `verified === false` and the role is one of `org`, `rescuer`, `shelter`, `sanctuary`, `zoo`, `breeder`, render an amber `Clock` icon chip with text "Pending verification" instead of the standard verified tick.
- Tooltip: "This account is awaiting Petos verification."

**Call-site audit (read-only check, no edits expected):** confirm `AuthorIdentity.tsx`, `AdoptGrid.tsx`, `BoardingList.tsx`, and `OrgProfile.tsx` already pass the verified flag; if any pass `verified` as always-true, switch to the actual DB field.

### 2. BredOnPetosRibbon on feed posts
**File:** `src/components/PostFeed.tsx`
- For posts where the author role is `breeder` AND the post has an attached `litter_id` or `pet_listing_id` referencing a Petos-bred lineage, overlay `<BredOnPetosRibbon />` on the top-left of the first image.
- Reuse the existing component — only the placement is new. Use `absolute top-2 left-2 z-10` inside the existing image container.

### 3. Kennel daily-report sample preview
**File:** `src/pages/OrgProfile.tsx` (kennel branch) + new `src/components/kennel/DailyReportSamplePreview.tsx`
- New component renders a static, non-interactive sample sheet styled identically to `DailyReportSheet` (meals ✓, walks ✓, sleep, mood emoji, 2 sample photos placeholder, vet-note line).
- Caption above it: "Sample daily report — this is what you'll receive each evening when your pet stays here."
- Shown only on kennel-type org profiles, in the Services tab below the boarding list.

## Technical details

- No new DB migrations. All three items are pure UI.
- No new dependencies.
- `verified_at` already exists on `profiles` and `organizations` from prior rounds — use `verified_at IS NOT NULL` as the truth source.
- Estimated diff: ~120 lines across 3–4 files.

## After this round

- Run a final pass on `AuthorIdentity` + `SellerBadge` to confirm the pending chip appears correctly on a test unverified account.
- Then: publish.

This is the last round. No round 32.