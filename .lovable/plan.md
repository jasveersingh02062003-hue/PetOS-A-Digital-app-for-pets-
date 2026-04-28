## Goal

Ship a coherent Phase 1 social layer for PetOS combining Instagram-style aesthetic (clean profiles, grids, stories) with Strava-style substance (care streaks, milestones, health badges visible on profiles). Owners are the followable identity; pets are listed on their owner's profile.

---

## What Users Will Get

### 1. Owner Profile pages — `/u/:userId`
- Header: avatar, full name, city, bio, follower/following counts, **Follow / Unfollow** button
- "Pets" rail — horizontal scroll of all pets owned (tap → pet profile)
- **Strava-style stat strip**: care streak (days), total walks logged, milestones earned
- Tabs:
  - **Posts** — 3-column IG-style grid of all posts (any pet)
  - **Pets** — full list with breed, age, verified badge
  - **Achievements** — badges (vaccination ✓, 30-day streak, first mate, etc.)

### 2. Pet Profile pages — `/pet/:public_id`
- Hero: big avatar, name, breed, age, gender, verified badge, "Owned by [owner]" link
- Health-aesthetic strip: vaccination status, care streak for this pet, weight trend sparkline
- 3-column post grid (filtered to posts tagged with this pet)
- "Available for mating" CTA if discoverable
- Share button → copies `petos.app/pet/PET-XXXXX` deep link

### 3. Follow system (owner-to-owner)
- New `follows` table: `follower_id`, `following_id`
- Follow/Unfollow button on owner profile + post cards (tap avatar → profile)
- New **"Following" tab** on Home feed (alongside For You)
- Notification on new follower

### 4. Stories (24h ephemeral)
- New `stories` table with `expires_at = created_at + 24h`
- Top of Home: existing stories rail becomes real (currently links to health timelines)
- Tap your avatar with `+` → camera/upload → 24h story
- Tap any story → fullscreen viewer with progress bars, tap to advance
- Auto-cleanup via existing cron infra (or filter by `expires_at > now()`)

### 5. Strava-substance touches
- **Care streak badge** visible on every owner profile + every post card avatar
- **Milestones** auto-awarded: "First post", "7-day streak", "First vaccination logged", "First playdate" — shown as small chips on profile
- Replaces vanity metrics with care metrics where it matters

---

## Technical Plan

### Database migrations

```sql
-- 1. Owner-to-owner follows
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
-- policies: select all authed; insert/delete own (where follower_id = auth.uid())

-- 2. Stories
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  pet_id uuid,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  view_count int not null default 0
);
alter table public.stories enable row level security;
-- policies: select where expires_at > now(); insert/delete own

create table public.story_views (
  story_id uuid not null,
  viewer_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- 3. Achievements (lightweight, derived where possible)
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid,
  kind text not null,  -- 'first_post','streak_7','streak_30','vaccinated','first_mate', etc.
  earned_at timestamptz not null default now(),
  unique (user_id, pet_id, kind)
);
alter table public.achievements enable row level security;
-- policies: select all authed; insert via SECURITY DEFINER trigger only

-- 4. Realtime
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.stories;

-- 5. Notification trigger on new follow
-- on insert into follows -> notify_user(following_id, 'new_follower', ...)

-- 6. Achievement triggers
-- on first post -> insert achievement 'first_post'
-- on activity_log streak -> handled by daily edge function or computed view

-- 7. Storage bucket
-- create 'stories' public bucket (mirrors 'posts')
```

### New components

- `src/pages/UserProfile.tsx` — `/u/:userId`
- `src/pages/PetProfile.tsx` — `/pet/:publicId`
- `src/components/social/FollowButton.tsx` — handles follow/unfollow + optimistic UI
- `src/components/social/StoryRail.tsx` — replaces current static stories on Home
- `src/components/social/StoryViewer.tsx` — fullscreen modal with progress bars + tap-to-advance
- `src/components/social/StoryComposer.tsx` — image picker, caption, upload to `stories` bucket
- `src/components/social/PostGrid.tsx` — 3-col square grid for profiles
- `src/components/social/AchievementChips.tsx` — horizontal scrolling badges
- `src/components/social/CareStreakBadge.tsx` — small streak pill (reusable on avatars)
- `src/components/social/StatStrip.tsx` — followers / following / streak / posts row

### Updated files

- `src/App.tsx` — add `/u/:userId` and `/pet/:publicId` routes
- `src/components/PostFeed.tsx` — add `scope: "following"` filter; make avatars link to `/u/:userId`; tagged pet name links to `/pet/:publicId`
- `src/pages/Home.tsx` — add Following / For You tabs; replace stub stories with real `<StoryRail />`; add `<StoryComposer />` trigger on own avatar
- `src/pages/Discover.tsx` — add "People to follow" rail (suggested owners by city/breed overlap)
- `src/pages/Profile.tsx` — turn into a redirect to `/u/:currentUserId` so own profile uses the same component
- `src/hooks/useFollows.tsx` (new) — `useIsFollowing(userId)`, `useFollow()`, `useUnfollow()`, `useFollowerCount(userId)`
- `src/hooks/useStories.tsx` (new) — fetch active stories grouped by author
- `src/hooks/useAchievements.tsx` (new)

### Hook into existing systems

- Notifications: extend `notify_user` calls — `'new_follower'`, `'achievement_earned'`
- Reuse existing `posts` storage bucket pattern for `stories` bucket
- Reuse existing `ReportButton` on stories and profiles

---

## Out of Scope (Saved for Phase 2+)

- Groups (breed/city/interest)
- Short-form video / Reels
- Collab posts (tag a playdate buddy on one post)
- Daily Pet Moment prompt (BeReal-style)
- Verified Vet Q&A feed
- Algorithmic For You ranking (Phase 1 stays chronological + simple "Following")

---

## Risks / Decisions Made

- **Pets are not directly followable** — keeps follow graph simple; users follow owners and see all their pets
- **Stories use storage + DB row, no separate signed URLs** — public bucket, same as posts
- **Achievements are stored, not computed** — faster reads, awarded by triggers/edge functions
- **No public like counts on health-related posts** — already aligned with earlier ethics note (Strava model, not TikTok)
- **First-load cost**: ~6 new pages/components, 1 migration with 4 tables. Estimated 1 build cycle.

After approval I will run the migration, create the components, wire up routes, and ensure realtime + notifications work end-to-end.