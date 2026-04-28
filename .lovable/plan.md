## Petos — Journey Audit & Gap Plan

I walked your spec (Anika & Max, Dr. Sharma) line by line against the routes, components, tables, and edge functions in the repo. Here's the honest checklist.

---

### Is the user journey "correct"?

Mostly **yes** — your 5 pillars (Social + Mating + Doctor/AI + Vet + Services) all exist in the schema and routing. The journey order in your doc is sound. Two structural notes:

1. **AI triage → Vet handoff is a broken link.** `/ai` (AiChat) and `/askvet/new` exist, but the AI does not generate a pre-filled summary and "Connect to Vet Now" doesn't auto-create an `appointments` or `vet_consults` row from the chat context. Today the user has to retype everything.
2. **Photo → Health auto-suggest is one-way.** `Composer.tsx` lets you tag a post as a health log (we built that in Wave 5), but there is no *prompt* after posting that says "Log this as Max's walk?". The trigger fires only if the user explicitly tags.

Everything else in your journey maps to real code — but several steps are stubs or partial.

---

### ✅ Implemented (works end-to-end)

**Owner journey**
- Sign up + Google + onboarding + add pet (`Auth`, `Onboarding`, `PetEditor`)
- Pet ID generation + QR (`PetIdCard`, `public_id` on `pets`)
- Home with stories, daily prompt, missing strip, daily tip, meetups, feed (`Home.tsx`)
- Posts: photo, caption, hashtags (`#tag` auto-extracted), trending rail, reactions (love/paw/laugh/wow/sad), comments, stories 24h (`PostFeed`, `ReactionBar`, `Hashtag`, `StoryRail`)
- Health vault tabs: Vitals, Meds, Parasite + records timeline (`Health.tsx`, `health/Timeline.tsx`)
- Photo→Health *manual* tagging via `HealthTagPicker` + `tg_post_to_health` trigger
- AI chat with pet context (meds + latest weight in system prompt) (`supabase/functions/chat`)
- Mating: discoverable pets, listings, requests, digital agreement w/ e-sign (`MatesNew`, `MateListing`, `mating_agreements`)
- Services marketplace: providers, bookings, reviews (`Services`, `ServiceDetail`, `BookingSheet`)
- Shop + cart + orders (`Shop`, `Cart`, `Orders`)
- Missing pets + sightings + geo alerts (`MissingFeed`, `MissingNew`, `MissingDetail`)
- Groups + meetups + RSVP (`Groups`, `Meetups`)
- Daily moments + streaks + collab posts (`Daily`, `daily_streaks`, `post_collaborators`)
- Ask-a-Vet public Q&A (`AskVet`)
- Notifications + bell + push job processor

**Vet journey**
- Vet apply → admin verify → role grant (`VetApply`, `Admin`, `user_roles`)
- Vet onboarding wizard (`vet/Onboarding`)
- Vet dashboard with Today / Schedule / Lookup tabs (`vet/Dashboard`)
- Pet ID lookup → access request flow (`pet_access_requests`, `pet_care_team`)
- Appointments (chat / video / in-clinic), `AppointmentRoom`, video room creation edge function
- Vet can read patient vault via `vet_can_read_pet` RLS
- Verified vet badge

---

### ⚠️ Partial / stubbed

| Feature | What's there | What's missing |
|---|---|---|
| AI → Vet handoff | AI chat works, AskVet works | No "Connect to Vet Now" button that pre-fills summary + creates consult |
| Photo → Health | Manual tag in composer | No post-upload "log this as walk?" smart prompt; no EXIF/location read |
| Pharmacy from Rx | `health_records` stores Rx | No Rx → cart auto-fill; no prescription builder UI for vets |
| Vet earnings | Schema implicit | No `/vet/earnings` dashboard |
| Walker GPS | Bookings exist | No live tracking (`walk_tracks` table + map) |
| Breeding soundness | `vaccination_verified` flag | No Brucella / hip / semen eval records; no "Breeding Verified" badge separate from vaccine |
| Puppy listings | Mating agreement exists | No `puppy_listings` table linked to agreement; no commission stub |
| Verifications queue (vet side) | Owner uploads cert | No vet-side queue UI to approve vaccination certificates |
| AMA / vet articles | AskVet exists | No "knowledge post" type; no AMA scheduling |
| Endorsements | Reviews exist for services | No skill-endorsement on vet profiles |
| Comment-as-pet | Comments work | `post_comments` has no `pet_id`; UI has no pet picker |

---

### ❌ Not implemented

- **Petos Points / wallet** — no table, no earn rules, no redeem
- **Weekly photo challenges + leaderboards** (city/breed) — no `challenges`, `challenge_entries`, no city leaderboard view
- **"1 year ago" memory cards** on Home
- **Petfluencer tier** + brand-collab marketplace
- **Save / Collections** (bookmarks) on posts
- **Smart allergy filter** on Shop (hide products containing pet's allergens)
- **Reward payment** for found missing pets (currently just a number, no payout)
- **Health Score** shown on Home ("🟢 Next vaccine in 5 days · streak 3 🔥") — partial: streak exists, score doesn't

---

### 🛠 Recommended build order (3 waves)

**Wave 6 — Close the core loop (highest user value)**
1. **AI → Vet handoff button** in `AiChat`: serialize last 6 messages + pet snapshot → create `vet_consults` row → route to `/askvet/:id` or `/book-vet?prefill=...`. Show "Connect to a vet" CTA after any AI reply containing risk keywords.
2. **Smart photo→health prompt** in `Composer` after upload: detect time-of-day + caption keywords (walk/meal/weight/poop) and pre-select a `HealthTagPicker` kind. Optional EXIF location.
3. **Health Score + status strip** on Home (`hooks/useHealthScore`): combines vaccine due dates, parasite due, log streak. Render above stories.
4. **Comment-as-pet**: add `pet_id` nullable column to `post_comments`, pet selector in `CommentSheet`, render with pet avatar/name.
5. **Save / Collections**: `post_saves` table + bookmark icon in `PostFeed` + `/profile` "Saved" tab.

**Wave 7 — Vet practice depth + commerce loop**
6. **Prescription Builder** in `AppointmentRoom` (vet side): structured drug/dose/duration → writes `medication_logs` AND a `pharmacy_cart_suggestions` row → owner sees "Buy prescribed meds" banner that pre-fills cart.
7. **Vet verifications queue** (`/vet/verifications`): list pending `health_records` of type vaccination uploaded by patients on care team; approve flips `pets.vaccination_verified`.
8. **Vet earnings page** (`/vet/earnings`): sum completed consults (beta = 0, schema-ready).
9. **Walker GPS** — `walk_tracks(booking_id, lat, lng, t)` table + provider's "Start walk" button streams location; owner sees live map in booking detail.
10. **Smart allergy filter** on `Shop`: hide products whose `tags` intersect active pet's `allergies`.

**Wave 8 — Gamification + virality**
11. **Petos Points wallet**: `points_ledger(user_id, delta, reason)` + earn rules trigger (post=5, health log=10, daily moment on-time=20, streak milestones). Profile widget.
12. **Weekly photo challenges**: `challenges`, `challenge_entries`, voting via reactions. Discover rail + winner badge.
13. **City/breed leaderboards**: SQL view ranking by points/followers, `/discover` rail.
14. **"1 year ago" memory cards**: cron edge function `daily-memory-drop` → `notifications` of type `memory` linking the old post; `MemoryCard` component on Home top.
15. **Breeding soundness records**: extend `health_record_type` enum with `brucella`, `hip_score`, `semen_eval`; add separate `breeding_verified` flag on `pets` flipped only when all three exist; "Breeding Verified" badge.
16. **Puppy listings**: `puppy_listings(agreement_id, ...)`, `/mates/litter/:id`, sale → 8% commission stub.

---

### Suggested next step

Start with **Wave 6** — it makes the *daily loop* feel finished. The AI→Vet handoff and smart photo→health prompt alone turn the app from "many features" into "one habit". Approve and I'll execute Wave 6 in default mode.