## Petos Social — Reality Check & Scoped Plan (Social tab ONLY)

**Scope guardrail:** Only files powering the Social experience will be touched. **No changes** to Mate, Health, Discovery, or Profile tabs.

### In-scope files (Social only)
- `src/pages/home/PetParentHome.tsx` (feed tabs, story rail, daily prompt — the social home)
- `src/components/PostFeed.tsx`
- `src/components/CommentSheet.tsx`
- `src/components/Composer.tsx`
- `src/components/social/*` (ReactionBar, PawBurst, FollowButton, SaveButton, StoryRail, StoryViewer, StoryComposer, DailyMomentComposer, DailyPromptBanner, CaptionWithTags, CollabPicker, etc.)
- `src/pages/Notifications.tsx` (only the social rows: reactions, comments, follows, mentions)
- `src/pages/Messages.tsx` + `src/pages/MessageThread.tsx`

### Explicitly OUT of scope (will NOT be edited)
- `src/pages/Health.tsx`, `src/components/health/*`
- `src/pages/Mates.tsx`, `MatesNew.tsx`, `MatesManage.tsx`, `MateListing.tsx`, mate components
- `src/pages/Discover.tsx`, `Explore.tsx`, `Hashtag.tsx`, discovery rails
- `src/pages/PetProfile.tsx`, `OrgProfile.tsx`, profile components

---

### Reality checklist (Social only)

**Shell (social-relevant)**
- [x] BottomNav, NotificationBell with unread dot, global Composer event, route fade-in

**Home feed (`PetParentHome.tsx`)**
- [x] StoryRail, DailyPromptBanner
- [x] For you / Following tabs
- [ ] **Trending tab missing** (PostFeed already supports `scope="trending"`)

**Post card (`PostFeed.tsx`)**
- [x] AuthorIdentity, role ring, inline FollowButton
- [x] Double-tap → PawBurst + haptic
- [x] ReactionBar (5 emojis, long-press popover)
- [x] CommentSheet, SaveButton
- [ ] **Share button missing** (no Web Share API)
- [ ] **Own-post ⋯ menu missing** (no Edit / Delete / Pin)

**Composer (`Composer.tsx`)**
- [x] Photo, pet chips, AI caption, Collab, RescueJourney, moderation
- [ ] **Format pills (Post / Story / Daily) missing** — single-format dialog
- [ ] **Multi-image carousel missing**
- [ ] **Live `#` and `@` autocomplete missing**
- [ ] **Visibility chip missing** (Public / Followers / Private)

**Comments (`CommentSheet.tsx`)**
- [x] Realtime, comment-as-pet, role rings, delete own
- [ ] **One-level threaded replies missing**
- [ ] **Long-press emoji reactions on comments missing**
- [ ] **`@` / `#` linkification in comment body missing**
- [ ] **"Author" chip on author replies missing**

**Notifications (social rows only)**
- [x] Inbox, grouping, filters, mark-read
- [ ] **Deep-link "flash highlight" on the target post/comment missing**
- [ ] **Bell entrance pulse on new realtime arrival missing**
- [ ] Aggregate grouping ("Aanya, Rohit and 3 others reacted") not implemented

**Messages (`Messages.tsx`, `MessageThread.tsx`)**
- [x] Inbox, presence dots, realtime
- [ ] **Typing indicator missing**
- [ ] **Per-message reactions (long-press) missing**
- [ ] **Swipe actions on inbox rows missing**
- [ ] **Pet-card share message type missing**
- [ ] **Vet/org pinned "Book" banner missing**

**Delight**
- [ ] 7-day streak confetti
- [~] ContextualFAB doesn't relabel per route

---

### Phased plan (Social tab only)

**Phase 1 — Visible feed wins** (PostFeed + PetParentHome + Notifications)
1. Add **Share button** to post card (Web Share API + clipboard fallback).
2. Add **Trending tab** as third tab in `PetParentHome.tsx`.
3. Add **own-post ⋯ menu**: Edit caption, Delete, Pin.
4. Add **deep-link highlight pulse** — Notifications appends `?focus=<id>`; PostFeed reads it and rings the matching card for 1.5s.
5. Add **bell entrance pulse** on realtime new-notification.

**Phase 2 — Composer upgrade** (Composer.tsx only)
6. Convert to **3-tab sheet** (Post / Story / Daily) reusing existing StoryComposer & DailyMomentComposer.
7. **Multi-image upload** with drag-to-reorder preview strip.
8. **Live `@` mention + `#` hashtag autocomplete** (debounced search on profiles + hashtags).
9. **Visibility selector** (Public / Followers / Private) with `posts.visibility` enum + RLS.

**Phase 3 — Conversation depth** (CommentSheet + small DB)
10. **One-level threaded replies** (`post_comments.parent_id` + Reply button).
11. **Comment reactions** (`comment_reactions` table + long-press popover reusing ReactionBar).
12. **Linkify `@` / `#`** in comment bodies.
13. **Author chip** on the post-author's own replies.

**Phase 4 — Messaging** (Messages.tsx + MessageThread.tsx)
14. **Typing indicators** via Realtime broadcast.
15. **Message reactions** (`message_reactions` table, long-press popover).
16. **Swipe actions** on inbox rows (mute/delete, mark-unread).
17. **Pet-card share** message type + **vet/org pinned banner** with Book CTA.

**Phase 5 — Delight**
18. 7-day streak confetti in `StreakChip.tsx`.
19. Aggregate notification grouping (SQL view).
20. ContextualFAB labels per route.

---

### Recommendation
Ship **Phase 1 + Phase 2** next — biggest visible promises from the journey doc (share, trending, multi-image, autocomplete, visibility). All edits stay within the social file list above; Health/Mate/Discovery/Profile remain untouched.

Tell me which phases to execute — `Phase 1`, `1 and 2`, or `all` — and I'll proceed.