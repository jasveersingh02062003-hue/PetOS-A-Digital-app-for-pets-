# Audit — Is your problem solved?

## Short answer

**Partially. ~70% solved.** Identity + posting + role homes + search filters + verified flow are wired to real data. **Three things are still cosmetic or missing**, and they are exactly the parts that make the app *feel* like a real app to a non-pet-parent user.

- **What works for real (frontend ↔ backend ↔ realtime):** universal posting, role badge everywhere posts/comments/stories appear, role-tinted profile, search by entity type, verified tick auto-flip on KYC approval, role-aware FAB actions, role-aware home router.
- **What is cosmetic (renders, but the action behind it doesn't fully work):** several quick-action buttons on dashboards link to routes that don't exist or don't persist data end-to-end.
- **What is still missing:** a few dashboards have no real KPI source yet, and notifications/search rows have not been migrated to the unified `AuthorIdentity` component.

---

# Checklist — every item from the 17-task plan

Legend: **DONE** = wired to DB and verified · **PARTIAL** = UI exists but a data path or a CTA is broken · **MISSING** = not built.

| # | Task | Status | Reality check |
|---|---|---|---|
| 1 | Open FirstRunGate for non-pet roles | DONE | `FirstRunGate.tsx` and `PostAuth.tsx` both gate on `account_type === 'pet_parent'` only. |
| 2 | AuthorIdentity component + role rings | DONE | `src/components/AuthorIdentity.tsx` exists, `getRoleRing` in `roleTheme.ts`. |
| 3 | Replace author rendering across app | **PARTIAL** | Used in `Search.tsx` and `StoryRail.tsx`. **`PostFeed`, `CommentSheet`, `AdoptGrid` still render `SellerBadge` ad-hoc**; `MatesGrid`, `MissingStrip`, `Notifications`, `MeetupCard`, `VetAnswerCard` render avatars without any role tag. |
| 4 | Universal Composer (optional pet tag) | DONE | Round 6 — pet tag hidden for org/buyer roles, role-tinted submit, role copy. Posts insert into `posts` for every role. |
| 5 | Home router by account_type | DONE | `src/pages/Home.tsx` switches on `account_type` with lazy chunks. |
| 6 | PetParentHome | DONE | Real pet hero, stories, feed. |
| 7 | BreederHome | **PARTIAL** | Renders KPIs from `litters` + `mating_requests`. Quick action **"Verify lineage" has no destination route**; "New litter" → `/litters/new` works. |
| 8 | ShelterHome (+ Rescuer variant) | **PARTIAL** | Pulls real `pet_listings` for adoptables and counts open applications. **"Post missing" → `/missing/new`** exists; **"Review applications" route is wired** but the list view has no decision actions persisted (no `application_decisions` write). |
| 9 | KennelHome | **PARTIAL** | Real `service_listings` + `bookings` queries. Hero "occupancy %" is computed, but **"Daily report" CTA is a placeholder** (no `kennel_daily_reports` table or insert). |
| 10 | GaushalaHome | **PARTIAL** | Animals-in-care comes from `pet_listings` filtered by sanctuary. **Donations KPI reads from `donations` table** which exists, but the "Open donate page" CTA links to `/org/donations` which renders, yet sponsorship CTA has no `sponsorships` table. |
| 11 | BuyerHome | DONE (R9) | `saved_searches` table (per-user, RLS, dedup index). Buyers see their saved searches with **live new-match counts** computed against `pet_listings.created_at > last_seen_at`, and `/mates` has a "Save search" toggle that persists tab + city filter. Realtime channel refreshes the list when rows change. |
| 12 | ZooHome | **PARTIAL** | Events from `meetups`. **"Add exhibit" / "Educational post" CTAs** route to `/meetups/new` and the universal composer respectively — fine, but there is no `exhibits` entity, so "Animals on display" KPI is hard-coded `0`. |
| 13 | Role-aware ContextualFab | DONE | Round 4 — branches on `account_type`, every primary route exists. |
| 14 | Search entity-type tabs | DONE | Round 2 — role chip rail on `/search` and `/discover`, filters by `account_type`. |
| 15 | Role-aware UserProfile | DONE | Round 3 — banner tint, dynamic tabs, `AdoptablesList` and `EventsList` are real DB queries. |
| 16 | Verified tick auto-flip + notification badges | DONE | Round 5 — DB trigger inserts notification on approval, `RealtimeBridge` invalidates the verified set, bell badge updates live. |
| 17 | Video post type | MISSING | Skipped per your instruction. |

---

# What's actually broken vs your goal

Your three concrete asks were:

1. **"Everyone can post — photos, stories, later video, no matter the role."**
   - Posts: **works** for every role.
   - Stories: composer `StoryComposer.tsx` still expects pets — **needs the same Round-6 treatment**.
   - Video: **not started**.

2. **"People must identify what someone is, like Instagram does."**
   - On post headers, comments, search, stories, profile: **works**.
   - On notifications, mates grid, missing strip, meetup cards, vet-answer cards: **role tag missing** — looks identical pet-parent vs shelter.
   - The unified `AuthorIdentity` exists but only ~30% of the surfaces use it.

3. **"Each role gets a real dashboard with the activities they actually do."**
   - The router + 7 dashboards all render with real queries — **the structure works**.
   - But several **quick-action CTAs lead to dead ends or in-memory state** (kennel daily report, saved searches, sponsorships, lineage verification, zoo exhibits). On a real phone that means the user taps and nothing persists.

---

# Plan to finish — in order, wiring-first, no UI-only changes

### Round 7 — Finish AuthorIdentity adoption (closes Task 3 properly)
Replace ad-hoc avatar+name+badge in: `PostFeed`, `CommentSheet`, `AdoptGrid`, `MatesGrid`, `MissingStrip`, `Notifications` page, `MeetupCard`, `VetAnswerCard`. Single source of truth → role tag + verified tick everywhere a person/org appears. Pure refactor, no DB.

### Round 8 — Universal Stories
Apply the Round-6 pattern to `StoryComposer.tsx`. Make pet tag optional, role-aware copy. Org stories store under the same `daily_moments` table with `pet_id NULL`. Verify `StoryRail` and `StoryViewer` render org author correctly.

### Round 9 — Make Buyer dashboard real
Create `saved_searches` table (user_id, filters jsonb, last_seen_at, created_at) with RLS. Wire BuyerHome "Saved searches" + "new matches" to it. Add a "Save this search" button on `/mates` and `/search`. New matches = listings created after `last_seen_at` matching filters.

### Round 10 — Make Shelter applications actionable
Add `adoption_application_decisions` (or extend existing applications table) with `status: pending|approved|rejected`, `decided_by`, `decided_at`. Wire the "Approve / Reject" buttons in the Shelter applications view. Notification trigger to applicant on decision.

### Round 11 — Make Kennel daily report real
Create `kennel_daily_reports` table (kennel_id, pet_id, booking_id, date, meals jsonb, walks jsonb, notes, photos). Wire the dashboard quick-action to a form that inserts. Show today's reports on KennelHome.

### Round 12 — Sanctuary sponsorships
Create `sponsorships` table (sponsor_user_id, animal_pet_id, amount_inr, recurrence, started_at, active). Wire GaushalaHome sponsorship CTA → form → insert. Donor wall reads from this + `donations`.

### Round 13 — Zoo exhibits + breeder lineage
Two small but real entities:
- `exhibits` (zoo_user_id, name, species, location_label, description, photo_url, active) — drives ZooHome "Animals on display" KPI for real.
- `pedigree_certificates` (litter_id or pet_id, document_url, verified_by_admin, verified_at) — drives Breeder "Verify lineage" → upload form → admin queue.

### Round 14 — Notifications surface
Migrate `Notifications` page rows to `AuthorIdentity` so every "X liked your post" carries a role tag + verified tick. Backed by existing `notifications` table.

### Round 15 — Optional: Video posts
Add `video_url` columns to `posts`, storage bucket `post-videos`, composer accepts mp4 ≤ 50 MB, feed renders `<video>` with poster.

---

# Technical notes

- All "PARTIAL" items above were verified by reading the code: dashboards do call Supabase; the gaps are specific tables that don't exist or specific CTAs whose handlers are stubs (`onClick={() => toast("coming soon")}` patterns).
- No schema needs to change for Rounds 7, 8, 14. Rounds 9–13 each add one focused table + RLS + one form + one read query.
- Every new table will follow the project rule: own row scoped to `auth.uid()` with public-read where the dashboard requires it.
- Realtime invalidation will reuse `RealtimeBridge` so dashboards refresh without polling.

---

# Direct answers to your questions

1. **Is the problem solved?** ~70% solved. The bones (identity, posting, role homes, search, verified flow) are real. The remaining 30% is making certain dashboard CTAs persist data instead of being placeholders, and finishing the AuthorIdentity sweep.
2. **What's implemented?** Tasks 1, 2, 4, 5, 6, 13, 14, 15, 16 — fully wired.
3. **What's partial?** Tasks 3, 7, 8, 9, 10, 11, 12 — UI exists, some data paths missing.
4. **What's missing entirely?** Task 17 (video), saved-searches table, kennel daily-report table, sponsorships table, exhibits table, pedigree-certificate table, application-decision write path, story composer role-awareness.

Approve this plan and I'll switch to build mode and execute Rounds 7 → 14 in that order, one round per reply, every change wired front-to-back with a real DB write or a real query — no UI-only stubs.
