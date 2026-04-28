# Plan: Photo→Health pipeline, AI context, Reactions, Memories & Hashtags

A focused wave that turns daily photo posting into health data, makes the AI assistant pet-aware, and adds the social-engagement layer (reactions, memories, hashtags). All built on existing tables — no new infra.

---

## 1. Photo → Health pipeline

When a user posts a photo, optionally tag it as a health moment and auto-create a `health_records` row.

**DB**
- Add columns to `posts`: `health_kind text` (nullable, enum-like: `meal | walk | weight | mood | grooming | medication | symptom`), `health_pet_id uuid` (nullable, FK pets), `health_value jsonb` (e.g. `{kg: 12.4}`, `{minutes: 30}`).
- Trigger `tg_post_to_health`: when `health_kind` and `health_pet_id` are set on insert AND user owns the pet, insert into `health_records` (`pet_id`, `record_type=health_kind`, `title=auto`, `notes=post.caption`, `occurred_on=now`, plus a `source_post_id` column added to `health_records`).

**UI**
- `Composer.tsx` — new collapsible "Tag as health log" section: pet picker (user's pets), kind chips, optional value field per kind (weight kg, walk minutes).
- New `src/components/health/HealthTagPicker.tsx`.
- `Health.tsx` Timeline — show small photo thumbnail when record was created from a post (`source_post_id`).

---

## 2. AI context enrichment

Make `/ai-chat` aware of the active pet's vitals, conditions, and recent logs.

**Edge function** `supabase/functions/chat/index.ts`
- Accept optional `pet_id` in request body.
- If provided + caller owns pet, server-side query: pet (species, breed, age, weight, neutered, allergies), latest 10 `health_records`, active medications, latest 3 vet consult notes (if any).
- Inject as a structured system message before user turn: "You are advising about {pet}. Recent context: ..."

**UI**
- `AiChat.tsx` — pet selector at top (defaults to first pet). Pass `pet_id` with each call.
- Show a small "Context: Buddy · 3yo Lab · last weight 22kg" chip.

---

## 3. Multi-emoji Paw reactions

Replace single-like with 5 reactions: ❤️ 🐾 😂 😍 😢. Backwards compatible.

**DB**
- New table `post_reactions (id, post_id, user_id, kind text check in (love,paw,laugh,wow,sad), created_at, unique(post_id, user_id, kind))`.
- Backfill: copy existing `post_likes` rows as `kind='love'`.
- Add `posts.reaction_counts jsonb default '{}'` updated by trigger `bump_reaction_counts`.
- Keep `post_likes` table as legacy alias (view or trigger) so existing UI still works during migration; new code reads `post_reactions`.

**UI**
- `src/components/social/ReactionBar.tsx` — long-press / hover to open picker, tap to toggle.
- Update `PostFeed.tsx` to use reactions instead of like-only.
- Realtime subscription on `post_reactions`.

---

## 4. Hashtags + trending

**DB**
- New table `post_hashtags (post_id, tag text, primary key(post_id, tag))`.
- Trigger on post insert: parse `#word` from caption, lowercase, insert rows.
- Materialised view (or simple query) `trending_tags`: count of `post_hashtags` in last 24h grouped by tag.

**UI**
- `Composer.tsx` — render `#tags` as chips in preview.
- New page `src/pages/Hashtag.tsx` route `/t/:tag` showing recent posts with that tag.
- `Discover.tsx` — add "Trending" rail (top 10 tags, 24h).
- Make `#tag` in caption clickable in `PostFeed.tsx`.

---

## 5. Memory cards ("1 year ago today")

**Edge function** `memories-daily` (cron daily 7am UTC):
- For each user, find their posts created on this calendar day in prior years.
- Insert into `notifications` with type `memory` and link to a new page.

**UI**
- `src/components/social/MemoryCard.tsx` — shown on `Home.tsx` if memory exists for today.
- Page `src/pages/Memory.tsx` (`/memory/:postId`) — re-share button creates a new post with original photo + "1 year ago" overlay.

---

## Technical notes

- All new tables get RLS: `select` open for authenticated, `insert/delete` only by `auth.uid() = user_id`.
- `post_reactions` and `post_hashtags` added to `supabase_realtime` publication.
- No new storage buckets needed (reuses `posts`).
- `health_records` already exists with proper RLS; only adding `source_post_id uuid` column.
- All triggers `SECURITY DEFINER SET search_path = public`.

---

## Build order

1. Reactions (migration + ReactionBar + PostFeed swap)
2. Hashtags (migration + Composer + Hashtag page + Discover rail)
3. Photo→Health (migration + Composer health section + Timeline thumbnails)
4. AI context (chat function + AiChat pet selector)
5. Memory cards (cron function + MemoryCard + page)

Approve to start with step 1 (reactions) and proceed sequentially in the same loop.
