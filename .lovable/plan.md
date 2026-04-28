# Petos — completed waves

## Phase 1-4 (done previously)
Profiles, pets, follows, stories, feed, AskVet, Groups, Meetups, Daily moments, Collab posts.

## Wave 5 — Engagement layer (current)

**Done:**
1. **Multi-emoji reactions** — `post_reactions` table (love, paw, laugh, wow, sad), reaction_counts on posts, ReactionBar with long-press picker, realtime updates. Legacy `post_likes` backfilled.
2. **Hashtags** — `post_hashtags` auto-extracted from captions via trigger, `/t/:tag` page, `trending_hashtags` view (24h), TrendingHashtagsRail on Discover, clickable #tags in feed via CaptionWithTags.
3. **Photo→Health pipeline** — posts can carry `health_kind`, `health_pet_id`, `health_value`. Trigger creates a `health_records` row linked back via `source_post_id`. HealthTagPicker UI in Composer with kinds: meal, walk, weight, mood, grooming, medication, symptom.
4. **AI context enrichment** — `chat` edge function now also pulls active medications into the system prompt (vaccinations, symptoms, records, allergies, conditions were already included).

**Deferred:**
- Memory cards ("1 year ago") — needs cron edge function; build next.
- Petos Points / gamification.
- Comment-as-pet-voice.
- Boosted listings & premium gating.
- Service GPS tracking.
- Short-form video.
