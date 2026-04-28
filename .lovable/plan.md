# PetOS Social Roadmap — Phases 2, 3, 4

Building on the Phase 1 social foundation (follows, stories, achievements, user/pet profiles), this plan layers Community → Authority → Virality. Each phase ships independently and reuses existing infrastructure (`profiles.interests`, `service_bookings`, `appointments`, `posts`, `stories` bucket).

---

## Phase 2 — Community

### 2.1 Groups (breed + city + interest)
Self-organising communities so owners with the same breed, city, or interest find each other.

**New tables**
- `groups` — id, slug, name, kind (`breed` | `city` | `interest`), key (e.g. "golden_retriever", "bengaluru", "raw_feeding"), description, cover_url, member_count, created_by, created_at
- `group_members` — group_id, user_id, role (`member` | `mod` | `owner`), joined_at
- `group_posts` — group_id, post_id (links existing `posts` row to a group; a post can live in a group AND the global feed)

**Auto-suggestion**
- On profile load, suggest groups matching `pets.breed`, `profiles.city`, `profiles.interests`. One-tap join.
- Seed ~30 starter groups across top breeds + top Indian cities so groups are never empty on day 1.

**UI**
- New page `/groups` — "Your Groups", "Suggested for you", search.
- New page `/g/:slug` — cover, member count, join button, group-scoped feed, members tab.
- Composer gets an optional "Post to group" picker.
- Home feed adds a "Groups" tab next to For You / Following.

### 2.2 Local Pack — pets near you
A discovery rail surfacing nearby pets and owners.

**Reuses** `profiles.city` + `pets.city` (already populated). No GPS needed for v1.

**UI**
- Discover page gets a "Local Pack — Pets in {city}" horizontal rail at the top: avatar, name, breed, distance hint, follow button.
- "See all" → `/discover/local` grid with filters (species, breed, age range).

**Future**: optional precise location opt-in for true radius queries (defer).

### 2.3 Playdates & Meetups
Owner-organised events; reuses booking/notification patterns.

**New tables**
- `meetups` — id, host_id, group_id (nullable), title, description, city, venue, lat/lng (optional), starts_at, capacity, cover_url, status (`upcoming` | `cancelled` | `done`), created_at
- `meetup_rsvps` — meetup_id, user_id, pet_id, status (`going` | `maybe` | `declined`), created_at; trigger bumps `meetup.attending_count`
- Notification trigger: notify host on RSVP, notify attendees 24h before via existing `notification_jobs` cron pattern

**UI**
- New page `/meetups` — upcoming list filtered by city + group.
- `/meetups/new` composer.
- `/meetups/:id` detail with RSVP, attendee pet grid, host contact.
- Surface upcoming meetups card on Home.

---

## Phase 3 — Authority + Trust

### 3.1 Verified Vet Q&A (AskVet feed)
Public Q&A where verified vets build a following and convert to paid consults.

**New tables**
- `vet_questions` — id, asker_id, pet_id (optional), title, body, species, category (`behavior` | `nutrition` | `medical` | `training` | `other`), photo_urls[], status (`open` | `answered` | `closed`), best_answer_id, view_count, created_at
- `vet_answers` — id, question_id, vet_id, body, helpful_count, created_at; only `has_role(uid, 'vet')` can insert (RLS)
- `vet_answer_helpful` — answer_id, user_id (unique), trigger bumps helpful_count

**Trust + revenue loop**
- Every answer card shows the vet's name, verified badge, helpful count, and a **"Book consult with Dr. X"** CTA → existing `/book-vet?vetId=...` flow.
- Vets accumulate "helpful" reputation displayed on their profile, driving organic discovery.

**UI**
- New page `/askvet` — feed of questions, filter by category/species, "Ask a vet" composer.
- `/askvet/:id` — question detail, answers ranked by helpful_count + verified-vet first.
- Vet dashboard gets an "Open questions" inbox.

### 3.2 Pet Achievements / Badges (expansion)
Build on existing `achievements` table.

**New badge kinds** (auto-awarded via triggers):
- `vaccinated` — when `pets.vaccination_verified` flips true
- `dewormed_3m` — parasite preventative within last 90 days
- `care_streak_30` — 30 consecutive days with any `activity_logs` row
- `social_butterfly` — attended 3+ meetups
- `helpful_neighbour` — reported a missing-pet sighting that led to resolution
- `verified_vet` — auto-granted when vet role approved

**UI**
- Badge cabinet on `/u/:userId` and `/pet/:publicId` already renders `AchievementChips`; extend with a "View all" sheet showing locked + unlocked with progress hints (e.g. "12/30 days").
- Toast + confetti on first unlock; share-to-story CTA.

---

## Phase 4 — Virality

### 4.1 Short video posts (Reels-style)
**Schema additions** to existing `posts`:
- `media_type` (`image` | `video`), `video_url`, `thumbnail_url`, `duration_sec`, `aspect_ratio`

**Storage**: reuse `posts` bucket; client-side trim to ≤60s using browser MediaRecorder + canvas thumbnail. No server transcoding for v1.

**UI**
- New `/reels` route — full-screen vertical swipe feed, autoplay muted, tap to unmute, double-tap to like.
- Composer gains "Record video" tab with live trim.
- Home feed video posts render inline with the same player component.

### 4.2 Daily Pet Moment (BeReal-style)
Drives daily engagement with a randomised prompt window.

**New tables**
- `daily_prompts` — date (PK), prompt_text, prompt_emoji
- `daily_moments` — id, user_id, pet_id, post_id, prompt_date, captured_at, on_time (boolean — within 2h of notification)

**Mechanics**
- Edge function (cron, daily at random time 10:00–20:00 IST) picks the day's prompt and fans out push notifications via `notification_jobs`.
- Users have 2 hours to post a "Moment" tagged with that day's prompt for the on_time badge.
- Late posts still count for the streak but no on_time flag.
- Streaks displayed on profile ("🔥 14-day moment streak").

**UI**
- Home gets a "Today's Moment" card at the top until the user posts.
- New `/moments` archive: calendar grid of past prompts + your captures.

### 4.3 Collab posts (tag playdate friends)
Multi-author posts that appear on every collaborator's profile grid.

**New tables**
- `post_collaborators` — post_id, user_id, pet_id (nullable), accepted (boolean default false), invited_at, accepted_at
- View `posts_with_collaborators` joins for feed queries.

**UI**
- Composer gets "Tag friends" picker (autocomplete from your follows).
- Tagged users get a notification → accept/decline in-feed; accepted collabs show on their grid.
- Post header shows "Aria + Bruno + Charlie" with stacked avatars.

---

## Technical details

### Data & RLS
- All new tables enable RLS with the same patterns as Phase 1: public read where appropriate (`groups`, `meetups`, `vet_questions`, `vet_answers`, `daily_prompts`), owner-only insert/update, role-gated insert for vet answers via `has_role(auth.uid(), 'vet')`.
- Triggers reuse `notify_user(...)` for follower/answer/RSVP notifications.
- Meetup reminders + daily-prompt fanout use the existing `notification_jobs` queue + cron pattern.

### Files to create
- Pages: `Groups.tsx`, `GroupDetail.tsx`, `Meetups.tsx`, `MeetupDetail.tsx`, `MeetupNew.tsx`, `AskVet.tsx`, `AskVetDetail.tsx`, `AskVetNew.tsx`, `Reels.tsx`, `Moments.tsx`
- Components: `social/GroupCard.tsx`, `social/LocalPackRail.tsx`, `social/MeetupCard.tsx`, `social/RsvpButton.tsx`, `social/VetAnswerCard.tsx`, `social/BookVetCta.tsx`, `social/BadgeCabinetSheet.tsx`, `social/VideoPlayer.tsx`, `social/VideoComposer.tsx`, `social/MomentCard.tsx`, `social/CollabPicker.tsx`, `social/CollabAvatars.tsx`
- Hooks: `useGroups.tsx`, `useMeetups.tsx`, `useAskVet.tsx`, `useReels.tsx`, `useDailyMoment.tsx`
- Edge function: `supabase/functions/daily-moment-fanout/index.ts` + cron schedule

### Files to edit
- `src/App.tsx` — add 10 new routes
- `src/pages/Home.tsx` — add Groups tab, Today's Moment card, Upcoming Meetups card
- `src/pages/Discover.tsx` — add Local Pack rail
- `src/components/Composer.tsx` — group picker, video tab, collab picker
- `src/components/PostFeed.tsx` — render video posts, collab avatars
- `src/components/BottomNav.tsx` — add Reels icon
- `src/pages/UserProfile.tsx` & `src/pages/PetProfile.tsx` — extended badge cabinet, on_time streak

---

## Suggested ship order

Each phase ships in one go (similar scope to Phase 1, ~3-4 hours each):

1. **Phase 2 first** — biggest retention lift, lowest risk, all SQL + UI, no new infra.
2. **Phase 3 next** — direct revenue driver (AskVet → consults).
3. **Phase 4 last** — video + cron complexity; do once Community proves engagement.

Confirm to start with **Phase 2 (Community)**, or pick a different starting phase.