# Phase 4 — Virality (Daily Moment + Collab Posts)

Skipping short video for now (storage/bandwidth concerns — revisit later). Implementing the two engagement-driving virality features.

---

## 1. Daily Pet Moment (BeReal-style)

A randomized daily prompt that pushes everyone to post a candid pet photo within a 2-hour window. Builds streaks and a "today's moments" feed.

### Database
- `daily_prompts` table — one row per day with prompt text + `dropped_at` timestamp
  - `id`, `prompt_date` (unique), `prompt_text`, `dropped_at`, `window_minutes` (default 120)
- `daily_moments` table — links a post to a prompt + tracks on-time status
  - `id`, `prompt_id`, `post_id`, `user_id`, `posted_at`, `on_time` (bool), `late_minutes`
- `daily_streaks` table — per-user streak counter
  - `user_id` (PK), `current_streak`, `longest_streak`, `last_posted_date`
- New achievement kinds: `daily_moment_first`, `daily_streak_7`, `daily_streak_30`
- Triggers:
  - On `daily_moments` insert: compute `on_time` (within window), update `daily_streaks` (increment if yesterday or today, reset otherwise), award streak badges
- RLS: all readable by authenticated; user can only insert moments tied to their own posts

### Edge functions + cron
- `drop-daily-prompt` — runs once daily at a randomized time (cron triggers every hour, function self-checks if today's prompt already exists; if not, rolls a probability so the actual drop time varies). Picks a prompt from a curated list (sleepy, treat time, zoomies, derp face, walk view, etc.), inserts row, calls `notify_user` for all opted-in users with link `/daily`.
- Cron via `pg_cron` + `pg_net` (added to a non-migration insert because URL/key are project-specific).

### UI
- `/daily` page — `Daily.tsx`
  - Hero: today's prompt + countdown timer (window remaining)
  - "Post your moment" CTA → opens composer pre-tagged to today's prompt
  - Grid of today's moments (only visible to users who posted today, BeReal-style — "post to see")
  - Streak chip + leaderboard tab (top streaks this week)
- `DailyPromptBanner.tsx` — sticky banner on `Home.tsx` when prompt is live and user hasn't posted
- `useDailyPrompt.tsx` hook — fetches today's prompt, user's moment status, streak
- Composer reuses existing `PostComposer` with a `promptId` prop that creates the linked `daily_moments` row after the post insert

---

## 2. Collab Posts (multi-author)

Tag friends/playdate buddies on a post — it appears on every collaborator's profile grid, and they all get credit/notifications.

### Database
- `post_collaborators` table
  - `post_id`, `user_id`, `pet_id` (optional), `status` (`pending` | `accepted` | `declined`), `invited_at`, `responded_at`
  - PK: (post_id, user_id)
- Trigger: on insert → notify invited user (`collab_invite`); on accept → notify post author (`collab_accepted`)
- RLS:
  - Select: anyone authenticated (collabs are public once accepted; pending visible only to author + invitee)
  - Insert: only post author can invite
  - Update: only invitee can change their own status

### UI
- `CollabPicker.tsx` — searchable user picker in `PostComposer` (searches `get_profiles_public`); chips show selected collaborators
- `CollabBadge.tsx` — "with @alice & @bob" line under post header in `PostFeed`
- `useCollabs.tsx` hook — invites, accept/decline, list pending invites
- `PostGrid.tsx` update — include posts where user is an accepted collaborator (union with own authored posts)
- `UserProfile.tsx` — small "Collabs" tab showing posts they're tagged in
- Pending invites surface in `Notifications` with inline accept/decline buttons (or a `/collabs/invites` mini-page)

---

## 3. Files to be created / edited

**Created**
- `supabase/migrations/...phase4_virality.sql` — tables, triggers, RLS, new achievement kinds
- `supabase/functions/drop-daily-prompt/index.ts` — daily prompt drop function
- `src/hooks/useDailyPrompt.tsx`
- `src/hooks/useCollabs.tsx`
- `src/pages/Daily.tsx`
- `src/components/social/DailyPromptBanner.tsx`
- `src/components/social/DailyMomentGrid.tsx`
- `src/components/social/StreakChip.tsx`
- `src/components/social/CollabPicker.tsx`
- `src/components/social/CollabBadge.tsx`

**Edited**
- `src/App.tsx` — add `/daily` route
- `src/pages/Home.tsx` — inject `DailyPromptBanner`
- `src/components/PostComposer.tsx` (or wherever post creation lives) — accept `promptId`, integrate `CollabPicker`
- `src/components/PostFeed.tsx` — render `CollabBadge`
- `src/components/social/PostGrid.tsx` — include collab posts
- `src/components/social/AchievementChips.tsx` — add streak badges
- `src/pages/UserProfile.tsx` — add collabs tab
- `src/pages/Notifications.tsx` (if exists) — render collab invite actions
- Non-migration SQL insert: schedule `pg_cron` job for `drop-daily-prompt`

---

## Skipped (revisit later)
- **Short video / Reels** — needs bucket policies, transcoding, autoplay infra, mobile data concerns. Will tackle as Phase 5 once storage strategy is decided.

Approve to implement.