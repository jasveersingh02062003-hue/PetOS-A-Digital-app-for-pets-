
# Petos Social — From Clone → Category

A phased, non-overlapping build plan. Each phase ships independently, has clear backend + frontend boundaries, and passes a "live & real" bar (no mocks, real Supabase, real-time where it matters).

---

## What's changing (in plain English)

We're rebuilding the social experience around **the pet, not the human**, and wiring it to data Instagram cannot have (vaccines, walks, breed, age, location). Every phase below produces a *visible, shippable* improvement.

| Phase | Theme | User sees… |
|---|---|---|
| 0 | Foundations cleanup | Same UI, faster, no bugs |
| 1 | Pet-first feed card | Pet name/breed/age/health badges on every post |
| 2 | Pet-native reactions | 🐾 boop, 🦴 treat, 😋 yummy replace generic ❤️ |
| 3 | Smart composer + Home polish | Floating "+" with intents; cleaner Home; smart story prompt |
| 4 | Auto-milestones | "Bruno turned 1 today!" auto-posted from health/birthday data |
| 5 | Breed Tribes | Auto-joined feeds: "Labrador parents near you" |
| 6 | Real-time chat hardening | Message read receipts, typing, presence, push |
| 7 | Memory Reels | Auto slideshow "Bruno's first year" — shareable outside app |
| 8 | Vet-verified replies & Rainbow Bridge | Trust moat + lifetime retention |

We will **not** touch: payments, vet booking, taxi, shop. Those stay as-is.

---

## Phase 0 — Foundations (½ day, no UI change)

**Why first:** later phases depend on it. Zero overlap with feature work.

**Backend**
- Add `posts.kind` enum: `moment | milestone | memorial | tribe_post` (default `moment`).
- Add `posts.pet_snapshot jsonb` — denormalized `{name, breed, age_months, avatar_url, vaccines_ok, location_city}` written by trigger on insert. Avoids N+1 joins on every feed render.
- Add index `posts_kind_created_idx`.

**Frontend**
- Extend `FeedPost` type with `kind` + `pet_snapshot`.
- Single `usePetSnapshot(petId)` hook for fallback when snapshot is null (older posts).

**Done when:** existing feed renders identically but reads `pet_snapshot` instead of joining `pets` table.

---

## Phase 1 — Pet-First Feed Card 🥇 (highest leverage)

**Frontend only. No backend changes.**

Replace `PostCard` header in `src/components/PostFeed.tsx`:

```text
[Pet avatar w/ breed-color ring]  PUBG · Golden Retriever · 2y
                                  by @joe · 21h · 🔥 47-day streak
                                  💉 Vaccines up-to-date · 📍 2 km
[image]
"Meet pubg — first day at the park 🌳"
```

- New component: `src/components/social/PetPostHeader.tsx` (pet is primary, owner is secondary subline).
- New component: `src/components/social/PostTrustStrip.tsx` — vaccine badge, distance chip, streak.
- `displayName` fallback chain: pet → owner (already exists, just elevate pet visually).
- Remove the redundant top-right `FollowButton` on org posts; keep it for personal posts.

**Done when:** every feed card shows the pet as protagonist; the human handle is a subline; trust signals appear when data exists.

---

## Phase 2 — Pet-Native Reactions

**Backend**
- Extend the `reaction_kind` check (currently `love | paw | laugh | wow | sad`) to add: `boop | treat | yummy | strong | cute`.
- Backfill existing rows untouched.
- Update `reaction_counts` rollup trigger (already exists) — no logic change, just new keys.

**Frontend**
- Update `REACTIONS` in `src/components/social/ReactionBar.tsx`:
  - `🐾 Boop` (default tap), `🦴 Treat`, `😋 Yummy`, `❤️ Love`, `💪 Strong`, `🥰 Cute`.
  - Default double-tap action → `boop` (not `love`).
- Update `src/lib/reactions.ts` ReactionKind union + tests.
- Animations: keep PawBurst; add per-reaction emoji burst variants.

**Done when:** double-tap = boop; long-press shows the 6-emoji palette; counts update live via existing realtime channel.

---

## Phase 3 — Smart Composer + Home Polish

**Frontend only.**

**3a. Floating compose FAB → intent picker**
- New `src/components/social/SmartComposer.tsx`: bottom sheet with 4 intents:
  - 📸 Moment → existing photo composer
  - 🏆 Milestone → pre-fills caption from pet data
  - ❓ Ask community → routes to Ask Vet / group post
  - 🚨 Lost / Found → opens existing `MissingCreateSheet`
- Wire to existing `ContextualFab` instead of replacing.

**3b. Home cleanup (`src/pages/home/PetParentHome.tsx`)**
- Hide `StoryRail` when zero stories; replace with a `SmartStoryPrompt` card: *"📸 Share Pubg's morning — your followers are waiting"*.
- Rename "Personalised for" → "Today for {petName}" with max 3 cards (birthday countdown, nearby same-breed, upcoming checkup).
- Tighten spacing: standardize section vertical rhythm to `mt-6`.

**Done when:** Home no longer shows empty story row; compose is one tap with clear intents.

---

## Phase 4 — Auto-Milestones

**Backend**
- New table `pet_milestones` (`id, pet_id, kind, occurred_on, payload jsonb, posted_post_id`).
- Edge function `generate-milestones` (cron daily 09:00 user-local via existing pg_cron):
  - Birthday (`pets.dob`)
  - Vaccine completed (last 24h health_records)
  - First walk of season
  - Streak milestones (7/30/100 day)
- Function inserts a `posts` row with `kind='milestone'` and a generated caption + uses `pets.avatar_url`.
- RLS: pet owner can delete the auto-post within 24h (suppress next time).

**Frontend**
- New `MilestoneCard` variant in `PostFeed` (different background gradient, 🎂/🏅 badge).
- Settings toggle `notification_preferences.auto_milestones` (default on).

**Done when:** turning on a test pet's birthday tomorrow → tomorrow morning a milestone post appears in feed automatically.

---

## Phase 5 — Breed Tribes

**Backend**
- New tables:
  - `tribes` (`id, slug, name, kind: breed|life_stage|location, criteria jsonb`)
  - `tribe_members` (`tribe_id, user_id, pet_id, joined_at`)
  - `tribe_posts` (view: posts where author has matching pet/tribe)
- Seed top 50 breed tribes + life-stage tribes (puppy, senior, first-time).
- Trigger: when a pet is created/updated, auto-add owner to matching tribes.

**Frontend**
- New page `src/pages/Tribes.tsx` — grid of joined tribes.
- New page `src/pages/TribeDetail.tsx` — feed scoped to tribe + member rail.
- Add "Tribe" tab next to For-you / Following / Trending in Home.

**Done when:** signing up a Labrador auto-joins "Labrador Parents" tribe and that feed has real posts.

---

## Phase 6 — Real-time Chat Hardening

The chat tables already exist (`conversations`, `messages`, `is_conversation_member` RLS). What's missing for "more powerful than other apps":

**Backend**
- Add `messages.read_by jsonb` (array of `{user_id, read_at}`).
- Add `typing_indicators` ephemeral table OR use Supabase Realtime presence (preferred — no DB writes).
- Add `messages.delivery_status` derived view.
- Edge function `send-chat-push` triggered on insert → fans out web push to offline members.
- Enable realtime publication on `messages` and `conversations` (verify already enabled).

**Frontend (`src/pages/MessageThread.tsx`, `src/pages/Messages.tsx`)**
- Realtime `postgres_changes` subscription on `messages` filtered by `conversation_id`.
- Presence channel per conversation → typing dots + online status.
- Read-receipt update on viewport visibility.
- Optimistic send with rollback on error.
- Image/voice attachments via existing `uploadImage` lib (extend to audio).

**Done when:** two devices, two accounts → message delivered <500ms, typing dots, read ticks, push to backgrounded tab.

---

## Phase 7 — Memory Reels

**Backend**
- New table `memory_reels` (`id, pet_id, period: year|season|month, items jsonb, cover_url, share_token`).
- Edge function `generate-memory-reel` runs weekly per pet:
  - Picks top 12 posts by reactions in period.
  - Calls `og-image` style renderer to compose cover.
  - Stores items array of post_ids + computed thumbnails.
- Public share route renders without auth (using `share_token`).

**Frontend**
- New component `MemoryReelCard` on Home (when one is ready).
- New page `src/pages/MemoryReel.tsx` — Stories-style full-screen player.
- Share button → public URL → OG image preview on WhatsApp/IG (free virality).

**Done when:** a pet with 12+ posts gets a "Bruno's first year" reel that plays full-screen and shares as a link.

---

## Phase 8 — Vet-Verified Replies + Rainbow Bridge

**8a. Vet-verified comments**
- Backend: existing `helpful_vets` flag — surface on `post_comments` via join. Add `post_comments.vet_verified` materialized boolean.
- Frontend: green checkmark badge in `CommentSheet` when commenter is a verified vet.

**8b. Rainbow Bridge**
- Backend: `pets.memorial_at timestamp`, new `tributes` table (text + photo from any user).
- Frontend: when set, pet profile transitions to memorial layout (soft palette, "In loving memory", tribute wall, candle reactions).

**Done when:** marking a pet as memorial converts their profile to a tribute page where friends can leave messages.

---

## Cross-cutting non-functionals

- **Real, not mocked:** every query uses Supabase. No hardcoded data anywhere.
- **RLS first:** every new table gets policies before frontend access.
- **Realtime where it matters:** feed inserts, reactions, messages, presence.
- **Performance:** denormalized `pet_snapshot`, paginated infinite queries (already in place), lazy-loaded heavy components.
- **Analytics:** emit `analytics_events` for: reaction tapped, milestone posted, tribe joined, reel shared. Used to validate impact.
- **Backward compatible:** old posts without `pet_snapshot` or `kind` keep rendering via fallbacks.

---

## Suggested execution order (no overlap)

1. **Phase 0** (½ day) — foundation
2. **Phase 1** (1 day) — feed card V2  ← *biggest visible win*
3. **Phase 2** (½ day) — pet reactions
4. **Phase 3** (1 day) — composer + home polish
5. **Phase 6** (1.5 days) — chat hardening (parallel-safe with 4/5 if different person)
6. **Phase 4** (1 day) — auto-milestones
7. **Phase 5** (1.5 days) — tribes
8. **Phase 7** (1 day) — memory reels
9. **Phase 8** (1 day) — vet-verified + rainbow bridge

**Total:** ~9 working days for a launchable, category-defining social experience.

---

## Where I'd start when you approve

**Phase 0 + Phase 1 + Phase 2 in one push** — they ship together as the new "feed" and give you the headline screenshot for marketing in ~2 days. Backend changes are tiny (one migration), frontend changes are surgical to `PostFeed.tsx`, `ReactionBar.tsx`, plus 2 new components.

Ready when you are — say **"start with phases 0-2"** and I'll switch to build mode.
