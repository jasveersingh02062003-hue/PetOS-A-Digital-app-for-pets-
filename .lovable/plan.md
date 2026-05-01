
# Petos Engagement Polish — Honest, Targeted Build

## Why this plan is short

The reviewer's 8.7/10 list mixed genuine gaps with **work that's already shipped**. Auditing the current code:

| Reviewer item | Real status |
|---|---|
| Brand bar, Tribe + Nearby tabs, TodayPanel | ✅ Shipped last turn |
| Double-tap = boop with paw ripple | ✅ Already in `PostFeed.tsx` |
| Long-press radial reaction picker | ✅ Already in `ReactionBar.tsx` |
| Swipe-right save | ✅ Already in `PostFeed.tsx` |
| Daily prompt | ✅ `DailyPromptBanner` mounted on Home |
| Empty states | ✅ Designed for For-you / Tribe / Nearby |
| Vet-verified shield | ✅ `PawShield` renders on `vaccines_ok=true` |
| Service worker caching | ✅ `public/sw.js` exists |

Out of 14 items, **11 are already in the codebase**. Only 3 are real gaps.

## What we're explicitly skipping (and why)

- **Leaderboards / Boop Champion / Mystery Treat / Barkometry** — Candy-Crush gamification contradicts the "premium feel" we just shipped. These are dark patterns, not premium signals.
- **Auto-generated 15-sec memory reel video** — Server-side video rendering is a 2-day project (FFmpeg in edge runtime, queue, storage). Not worth one feature.
- **IndexedDB offline feed cache** — `sw.js` caches assets; caching feed *data* with stale-reaction invalidation is complex. Defer until users actually report it.
- **Color palette swap to `#FF6B6B` + `#4ECDC4`** — This is the most dangerous suggestion. The current warm-cream + leaf + coral palette is on-brand and premium. Swapping to flat coral + mint = generic 2014 startup. **Hard skip — would be a regression.**

## What we're building (3 features, ~90 minutes)

### 1. Reaction notifications — "X booped your post"
The `notifications` table exists. The `post_reactions` table exists. There's nothing connecting them today, so users never find out anyone reacted to their posts — which kills the return-visit loop.

**Build:** A `SECURITY DEFINER` trigger on `post_reactions INSERT` that writes a notification row to the post author. Skips self-reactions. Uses an emoji per reaction kind so the notification reads naturally ("Joe 🐾 your post").

**Database changes:**
- New function `public.notify_post_reaction()` — security-definer, sets `search_path = public`
- New trigger `trg_notify_post_reaction` on `post_reactions AFTER INSERT`
- No new tables, no schema changes to existing tables

### 2. Auto-milestone posts (daily)
Pet birthdays from `pets.date_of_birth` are sitting in the database doing nothing. Posting "Bruno turned 1 today 🎂" automatically is genuinely free engagement content — not a dark pattern, just surfacing facts the user already gave us.

**Build:**
- New edge function `supabase/functions/auto-milestones/index.ts` — runs daily, finds pets whose DOB matches today's month/day, inserts a `kind = 'milestone'` post tagged with `pet_snapshot.auto_milestone_key = 'birthday-{year}'` so it can't double-post.
- Owner opt-in via new `pets.auto_milestones` boolean column (defaults `true` — they can disable per pet in Settings).
- Index on `(pet_snapshot->>'auto_milestone_key')` for the dedup check.
- `pg_cron` schedule firing daily at 09:00 local time.

**Database changes:**
- `ALTER TABLE pets ADD COLUMN auto_milestones boolean DEFAULT true`
- New partial index for dedup
- `pg_cron` + `pg_net` schedule (set via `supabase--insert` per the schedule-jobs guidance — embeds project URL + anon key, not a portable migration)

### 3. Shareable moment cards (real OG previews)
Today, sharing a post link drops a generic favicon preview into WhatsApp/Twitter. Users want their pet's photo + identity baked into the share image. The `og-pet` edge function exists as a template — we mirror it for posts.

**Build:**
- New edge function `supabase/functions/og-post/index.ts` — renders a 1200×630 SVG share card: brand strip, pet photo (left half, rounded), pet identity (name in display font, breed/age, vaccinated badge, city), caption, "🐾 12 · 💬 4" tally.
- New page `src/pages/PostDetail.tsx` at `/post/:id` that uses `useSeo()` to inject the og-post URL as `og:image`. The existing `?focus=` deep-link in feed continues to work for in-app navigation.
- Update `handleShare` in `PostFeed.tsx` to share `${origin}/post/${id}` instead of `?focus=` so the OG meta gets fetched.

**No schema changes.**

## File-by-file plan

| File | Action |
|---|---|
| `supabase/functions/og-post/index.ts` | Create — SVG share card renderer |
| `supabase/functions/auto-milestones/index.ts` | Create — daily birthday/milestone job |
| `src/pages/PostDetail.tsx` | Create — `/post/:id` route, sets OG meta + renders the post |
| `src/App.tsx` | Add `/post/:id` route |
| `src/components/PostFeed.tsx` | Update `handleShare` to use `/post/:id` URL |
| `src/pages/settings/PetEditor.tsx` | Add toggle for `auto_milestones` |
| (DB migration) | Trigger + `pets.auto_milestones` column + dedup index |
| (DB insert) | `pg_cron` schedule for `auto-milestones` daily |

## Order

1. DB migration (trigger + column + index) — must approve this first
2. `og-post` edge function (deploys automatically)
3. `PostDetail` page + route + share-link update
4. `auto-milestones` edge function
5. `pg_cron` schedule via `supabase--insert`
6. Pet editor toggle for `auto_milestones`

## What I am NOT touching

- Color palette — staying with the current warm/leaf/coral tokens
- The home redesign (already shipped, working)
- Reaction picker, double-tap boop, swipe-save (already shipped)
- Service worker (already shipped)

## Acceptance

- React to your own post → no notification (correct).
- React to someone else's post → they get a "X 🐾 your post" notification immediately.
- Share a post link from WhatsApp → pet photo + identity preview shows up (not a generic favicon).
- The day a pet turns 1, 2, 3… a milestone post auto-appears at 09:00 (only once per year, only if owner opted in).

Approve and I'll ship in the order above.
