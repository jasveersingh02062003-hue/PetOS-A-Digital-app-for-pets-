
# Petos — Reality Check & QA Plan

You feel the app is "basic, static, hard to navigate." That feeling is correct, and it's diagnosable. This plan tells you exactly **what is real, what is fake, what will break on publish, where users get lost**, and gives you a **copy-paste QA prompt** you can run against the live preview to confirm everything yourself.

---

## 1. What's actually working (verified)

These are wired end-to-end with real DB, real RLS, real edge functions:

- **Auth** — email/password, Google OAuth, password reset
- **Profile + Onboarding** — first-run gate redirects to `/onboarding`
- **Pets** — create/edit, public_id sharing, vaccination verification flow
- **Posts feed** — composer, hashtags, reactions, comments, sharing, daily moments + streaks
- **Stories** — creation, viewing, view counters
- **Messaging** — 1:1 + group conversations, realtime, read receipts
- **Notifications** — DB notifications + push subscriptions table
- **Health vault** — records, medications, vaccinations, parasite, nutrition, activity logs, vet read access via care team
- **Tele-vet** — vet onboarding, appointments, consult rooms, ratings
- **Mating** — listings, requests, signed agreements
- **Services marketplace** — providers, bookings, reviews, walk tracking
- **Shop** — products, cart, orders
- **Missing pets** — alerts, sightings, geo-fanout via `notification_jobs`
- **Meetups + Groups** — RSVPs, member counts
- **AskVet** — questions, answers, helpful counts
- **Search** — unified across pets, people, posts, hashtags, services, vets, meetups
- **AI** — chat, photo-vet, caption suggest, content moderation (Lovable AI Gateway)
- **Trust & safety** — block users, report content, auto-mod log, admin moderation queue
- **Plus paywall** — UI + DB schema (in beta-free mode — see #2)
- **PWA** — service worker, manifest, install page
- **SEO** — meta + JSON-LD on key pages, sitemap edge function, OG image generator
- **Pet profile by share link** — just fixed in last turn

---

## 2. What is fake / stubbed / will not work in production

These look real but won't actually do their job when you publish:

| Area | Status | What happens today | What's needed to ship |
|---|---|---|---|
| **Stripe payments** | Stubbed (`beta_free`) | Plus & shop checkout creates a `payment_intents` row with `status='beta_free'` and instantly "succeeds" | Real Stripe keys + webhook secret; flip code path from beta to live |
| **Push notifications** | Stubbed | `send-push` edge function logs no-op when VAPID keys missing | Generate VAPID keypair, add as secrets |
| **Daily.co / video rooms** | Partially stubbed | Room URLs may be placeholder | Daily.co API key + room-create call |
| **SMS / phone OTP** | Off | Auth UI shows it but provider not configured | Twilio (or similar) in Auth provider settings |
| **Email transactional** | Default | Auth emails work via Cloud defaults; custom branded emails not set up | Custom domain + SMTP config |
| **Maps** | Basic | "Near me" works via DB geo functions, but no real map tiles rendered in most places | Mapbox/Google Maps key + `<MapView>` integration |
| **Image uploads** | Real but unconstrained | No size/format validation client-side, can blow storage | Add max-size + auto-resize in `ImageUpload.tsx` |
| **Content moderation** | Real but soft | Flags content but admins must manually act | Add auto-hide on `block` verdict |
| **Sitemap.xml route** | Edge function only | `/sitemap.xml` won't auto-resolve to the function on `.lovable.app` | Either rewrite at host or accept the function URL |

---

## 3. Why the app feels "basic & static"

Diagnosing the UX feeling. This is the real reason users get lost:

### 3a. The 5-tab bottom nav buries everything
Bottom nav only shows: Home · Discover · Health · Services · Profile. But the app has **40+ pages**: Messages, Notifications, Meetups, Groups, AskVet, Mates, Missing, Shop, AI Chat, Photo Vet, Walk, Search, Install, Daily, Hashtags, Settings, Admin, Vet…

A new user lands on Home and sees no entry point to most of these. They must either:
- Know the URL,
- Tap the search bar, or
- Find a card buried in Discover.

**Result:** the app feels like 5 disconnected pages instead of a platform.

### 3b. Home is content-only, not action-oriented
Home shows feed + missing strip + tip card. There's **no clear "what should I do next?" CTA** based on user state (no pets yet → add pet; no posts → write first; vaccination overdue → upload).

### 3c. No global FAB / + action
Instagram has a center "+". TikTok has a center "+". Petos has only the **Emergency siren** in the center — which is alarming, not inviting. Users don't know how to **post** without scrolling Home first.

### 3d. Static-looking surfaces
- All cards are similar weight (no hierarchy of importance)
- Few skeleton loaders → empty grey flashes feel broken
- Almost no motion / micro-interactions → feels like a wireframe
- Empty states are mostly text, not illustrated CTAs

### 3e. Discoverability of social features
- **Reels/video posts:** the Composer supports image, but no dedicated video/reel tab. Other users can see posts in the feed, but there's no algorithmic "For You."
- **Following someone's pet profile** works, but there's no "people you may know" or "popular pets in your city" surfaced prominently.
- **Profile pages** show posts/pets/badges tabs (good), but no follower-only content gating, no "shared meetups" social proof.

---

## 4. What will break the moment you publish

Concrete production risks, ranked:

1. **Plus subscriptions silently grant access to everyone** — `payment_intents` defaults to `beta_free`. If you publish with this, every user gets Plus features for free until you wire Stripe.
2. **Push notifications never fire** — users will enable them and never get any.
3. **Service worker caches stale code** — `public/sw.js` does basic offline caching. After a deploy, returning users may see old UI for a session. Add a versioned cache name.
4. **Image storage costs** — no size limits on uploads.
5. **Notification job fanout for missing pets** — `notify_missing_pet_alerts` notifies up to 5,000 nearby users per missing pet. With 100 missing reports = 500K rows. Fine for beta, watch in scale.
6. **`get_pets_public()` is callable by anonymous users** — security linter warning. Anyone can list every pet. Consider requiring auth.
7. **No rate limiting on AI endpoints** — anyone signed in can hammer Lovable AI, burning your credits.
8. **No email verification enforcement** — depending on Auth settings, fake emails can sign up.

---

## 5. Navigation & UX fixes (concrete, prioritized)

If we do nothing else, these 6 changes will make the app feel "real":

1. **Replace the emergency siren with a "+" composer button** in the center of the bottom nav. Move emergency to a long-press on the same button, or to the top bar.
2. **Add a smart Home hero** — based on profile state, show one of: "Add your first pet" / "Write your first post" / "Vaccination due for Pablo" / "3 meetups near you this weekend." One CTA, one tap.
3. **Add a top-level secondary nav** — a horizontal scrolling pill row under the header on Home with: Messages · Notifications · Meetups · AskVet · Missing · Mates · Walk. This surfaces the buried 35 pages.
4. **Add skeleton loaders** to PostFeed, Discover, Health, Profile (not just spinner-on-blank).
5. **Illustrate empty states** — "No posts yet — be the first" with a soft illustration + primary action button.
6. **Add a "What's new" tour** for first-run after onboarding — 3 swipeable cards highlighting Compose, Discover, Health.

---

## 6. The reality-check QA prompt (copy this)

Paste this into Lovable in **Chat mode** and let me run it against the preview. It's a 10-flow regression that mimics a real user's first 30 minutes:

---

> **You are a senior QA engineer for Petos. Open the preview as a brand-new user (sign up with a fresh email). Then act as a real first-time user and test these 10 flows end-to-end. After each flow, write: PASS / PARTIAL / FAIL with a one-line reason. At the end, give me a numbered list of every bug, dead-end, confusing screen, and broken interaction you found, ordered by severity (blocker → cosmetic). Do NOT fix anything yet — just report.**
>
> **Flow 1 — Onboarding:** Sign up with email. Complete the onboarding (name, city, add 1 pet). Land on Home. Was anything unclear or broken?
>
> **Flow 2 — Post a moment:** From Home, post a photo with caption "test #firstpost". Confirm it appears in feed, the hashtag is clickable, and the daily-streak counter (if any) updated.
>
> **Flow 3 — Discover others:** Open Discover. Search "pablo". Open the first pet result. Confirm pet profile loads with name, breed, owner, posts. Open the owner's user profile. Tap Follow.
>
> **Flow 4 — Messaging:** From the followed user's profile, tap Message. Send "hi". Confirm it appears in `/messages` and the thread.
>
> **Flow 5 — Health vault:** Open Health. Add a vaccination record for your pet. Confirm it appears in the timeline. Try to upload a document.
>
> **Flow 6 — Find a vet:** Tap "Ask a vet" or AskVet. Post a question. Confirm it lists in AskVet feed.
>
> **Flow 7 — Services & shop:** Open Services. Browse providers. Open one, attempt to book. Then open Shop, add an item to cart, attempt checkout.
>
> **Flow 8 — Plus paywall:** Trigger any Plus-gated feature (more than 1 missing pet, or `/plus` page). Tap upgrade. Confirm it either takes payment OR clearly says "free during beta."
>
> **Flow 9 — Missing pet alert:** Mark your pet as missing. Confirm the alert is created, appears on `/missing`, and you receive a notification (or job is queued).
>
> **Flow 10 — Settings & safety:** Block another user. Report a post. Toggle notification preferences. Sign out. Sign back in. Confirm session restores correctly.
>
> **Bonus: Navigation audit.** From Home, count how many taps it takes to reach: Messages, Meetups, AskVet, Missing, Walk, Photo Vet, Settings. Anything more than 2 taps = report as discoverability bug.

---

## 7. After the QA report — what we do next

Based on what the QA finds, we sequence:

1. **Wave 18 — Navigation overhaul**: composer "+", Home hero, secondary nav strip, skeleton loaders, illustrated empty states.
2. **Wave 19 — Pre-publish hardening**: image size limits, AI rate limits, SW cache versioning, optional auth-gating of `get_pets_public`.
3. **Wave 20 — Production switches**: real Stripe, VAPID push, Daily.co, sitemap host rewrite, branded auth emails.

You approve this plan, and I'll switch to build mode to **(a) run the QA prompt against the preview as the first action**, then **(b) start Wave 18 fixes** on the highest-severity findings.

---

## Technical notes (for engineers / future me)

- Bottom nav file: `src/components/BottomNav.tsx` (5 tabs, center slot wasted on emergency)
- Home hero would slot into `src/pages/Home.tsx` between header and tabs
- Secondary nav: new `<QuickAccessRail>` component, render in `Home.tsx` and optionally `Discover.tsx`
- Beta-free Stripe path: search `payment_intents` with `status='beta_free'` to find toggle points
- VAPID secret names to add: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Service worker cache fix: add `const CACHE = 'petos-v' + BUILD_ID` in `public/sw.js`
- Rate limit AI endpoints: wrap `ai-*` edge functions with `check_daily_limit('ai_calls', user, 50)`
- Pet listing privacy: revoke EXECUTE on `get_pets_public()` from `anon`, regrant to `authenticated`
