# Petos — Build Plan (v1, Phase-1 MVP)

A mobile-first **Progressive Web App** delivering the PRD's Phase-1 scope: pet identity, social feed, health vault, AI assistant, hyper-local mating, caretaker marketplace, shop basics, missing-pet alerts, and an admin panel. Premium minimal aesthetic. AI is real (via Lovable AI). Payments are stubbed (UI + ledger entries; real Stripe/Razorpay wired later).

## Scope confirmations
- **Platform**: Mobile-first responsive PWA (installable, full-screen on phones). Native iOS/Android apps come later.
- **Auth**: Email + password, Google OAuth, **and** phone OTP (phone OTP requires Twilio — see "What you'll need").
- **AI**: Real, powered by Lovable AI Gateway (Gemini), grounded in each pet's health vault.
- **Payments**: Stubbed. Every paid action (mating listing fee, vet consult, bookings, missing-pet alert, Petos Plus) shows the price, records a "transaction" with status `pending_payment`, and shows a "Beta — free for now" badge. Ready to swap in Stripe/Razorpay later.
- **Hardware (GPS tag), real video vet calls, OCR vaccination parsing, Razorpay escrow, insurance APIs**: out of scope for v1; placeholders only.

## Design language — "Premium Minimal"
- Near-monochrome surface: warm off-white background, deep charcoal text, single restrained sage-teal accent.
- Generous whitespace, hairline dividers, large editorial pet photography, soft 12–16px radii, no gradients, subtle motion only.
- Typography: editorial serif display (e.g. Fraunces) for headings, clean grotesque sans (Inter) for body.
- All tokens in `index.css` + `tailwind.config.ts` as semantic HSL variables; no hard-coded colors in components.
- Bottom tab bar with 5 tabs, floating circular **Emergency** action above center tab.

## Information architecture
5-tab bottom nav: **Home · Discover · Health · Services · Profile**. Floating Emergency button → AI triage sheet.

```text
/                    Home feed (followed pets, stories, posts)
/discover            Explore + Mates Nearby + Adoptable
/health              Active pet's vault + AI chat entry + consult history
/services            Boarding, walking, grooming, shop tabs
/profile             User + pet profiles, listings, wallet, settings

/auth                Sign in / sign up (email, Google, phone OTP)
/onboarding          User → Add pet → Vaccination upload → Interests
/pet/:id             Public pet profile (posts grid, followers)
/post/:id            Post detail
/mating/new          Create mating listing
/mating/:id          Listing detail + Express Interest
/agreement/:id       Digital mating agreement (template + e-sign)
/litter/:id          Puppy listing (post-agreement)
/ai                  Full-screen AI chat with active pet context
/vet/consult/:id     Tele-vet handoff screen (summary + "Connect")
/services/book/:id   Provider detail + booking
/shop, /shop/:id, /cart, /checkout
/missing/new, /missing/:id
/admin/*             Admin dashboard (role-gated)
```

## Feature breakdown

### 1. Auth & onboarding
- Supabase auth with email/password, Google, and phone OTP (Twilio-backed).
- Onboarding wizard: user details (name, city via geolocation + manual), add first pet (name, species, breed searchable list, DOB, gender, weight, neuter status), upload vaccination cert image (stored, manual review for v1 — no OCR), explicit "Discoverable for mating" toggle, multi-select interests.
- Biometric lock skipped (web limitation); session persisted via Supabase.

### 2. Pet profile (public + private vault)
- Public: avatar, bio, breed, posts grid, followers/following, follow button.
- Vault (owner-only): vaccination schedule with reminders, vet visit timeline, prescription/lab uploads, nutrition log, symptom diary, **QR code + 8-char access code** that grants a vet time-limited read access (RLS-enforced via signed access grants).

### 3. Social feed (real-time)
- Photo posts, short video posts, 24-hour stories.
- Like, comment, save, internal share. Realtime updates via Supabase Realtime channels for likes/comments.
- Home: algorithmic mix of followed pets + breed/interest matches. Explore: trending + city filter. Stories rail at top.
- Reporting + block.

### 4. Mating & breeding
- Create listing (city-locked to owner's city, pulls verified-vaccination badge from vault, blocks if not up to date).
- Browse "Mates Nearby" filtered by species/breed/age/gender, same city only.
- Express Interest opens a 1:1 chat. Either party can open the **Digital Agreement**: template fields (stud fee, puppy split, maternal care responsibility), both parties OTP-confirm to "sign", agreement stored immutably with timestamps.
- Post-litter: female owner creates puppy listings linked to agreement, with vaccination/deworming records. Buyer "Reserve" → marks transaction (escrow stub).
- Posting fee + agreement fee + 8% commission shown in UI; actual charge stubbed.

### 5. AI assistant + vet consult handoff
- Floating Emergency button → bottom sheet AI chat.
- Edge function calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with system prompt + RAG context: active pet's species, breed, age, weight, recent vaccinations, recent symptom diary entries, allergies. Streams tokens.
- Triage tool-call: model returns `severity: mild | moderate | severe` + structured summary. Mild → care advice in chat. Moderate/severe → "Connect to Vet" button → tele-vet handoff screen pre-filled with summary + vault snapshot.
- v1: "Connect to Vet" creates a consult request with status `awaiting_vet`; admin assigns vet; consult details + manually-entered prescription stored in vault. (Real video call deferred.)
- Petos Plus subscription tile (UI only).

### 6. Caretaker & service marketplace
- Two flows: professional boarding centers and gig walkers ("PetPals").
- Provider onboarding (separate role): KYC document upload, services offered, hourly/daily rate, availability slots.
- Owner books slot → booking record with status, address, notes. Walk tracking page shows live map placeholder + "Start/End walk" buttons that timestamp the booking. Real GPS via browser Geolocation API when walker is on the booking page.
- Ratings & reviews after completion. Commission % shown on payouts.

### 7. Shop
- Catalog (categories: food, treats, toys, grooming, accessories), product detail, cart, checkout (stub). Admin manages products. AI/health-tracker "Rebuy" suggestions on Health tab.

### 8. Missing pet alerts
- Owner posts alert (photo, last-seen on map via Leaflet, reward, contact). All users within ~5km (computed via PostGIS or simple haversine on lat/lng) get a push-style in-app notification + a banner on Discover.
- Sighting reports posted by community appear on the alert detail with photo + dropped pin.

### 9. Modular extras (lightweight v1)
- Adoption: NGO-flagged users post adoptable pets, free, with "Donate" button (stubbed).
- Insurance, grooming, vaccination verification: visible entry points, basic listing/forms, deeper integration in Phase 2.

### 10. Admin panel (role-gated `/admin`)
- Users & pets table (search, suspend, force-verify vaccination).
- Mating moderation queue + agreement viewer + dispute resolution.
- Vet/provider KYC review queue.
- Reported content queue.
- Financial dashboard reading the stubbed transaction ledger (GMV, commissions, payouts, escrow balances).
- Analytics tiles (DAU/MAU, top breeds, city demand, AI usage, conversion).
- Roles: `super_admin`, `moderator`, `finance` enforced via `has_role()` security-definer function on a separate `user_roles` table.

## Technical details

- **Stack**: React + Vite + TypeScript + Tailwind + shadcn/ui (already in repo). React Router, TanStack Query, react-hook-form + zod, react-markdown, Leaflet for maps, qrcode.react for vault access codes.
- **Backend**: Lovable Cloud (Supabase). Postgres with RLS on every table. Realtime channels for posts/likes/comments/chat/notifications. Storage buckets: `pet-avatars` (public), `posts` (public), `vault-docs` (private), `kyc` (private), `products` (public).
- **Auth**: Supabase email/password + Google + phone OTP (Twilio connector). `onAuthStateChange` listener wired before `getSession`.
- **Roles**: `app_role` enum (`user`, `pet_pal`, `boarding_provider`, `vet`, `ngo`, `moderator`, `finance`, `super_admin`) in a separate `user_roles` table with `has_role()` security-definer function. RLS uses this function — never read role from JWT or profiles.
- **Schema (high level)**: `profiles`, `user_roles`, `pets`, `pet_access_grants`, `follows`, `posts`, `post_media`, `likes`, `comments`, `stories`, `vaccinations`, `vet_visits`, `prescriptions`, `nutrition_log`, `symptom_diary`, `mating_listings`, `mating_interests`, `mating_chats`, `mating_messages`, `mating_agreements`, `litters`, `puppies`, `vet_consults`, `service_providers`, `service_listings`, `service_bookings`, `reviews`, `products`, `cart_items`, `orders`, `order_items`, `missing_alerts`, `sightings`, `notifications`, `transactions` (stub ledger), `reports`.
- **AI edge function** (`/chat`): accepts pet_id + messages, fetches vault context, calls Lovable AI Gateway with streaming, supports tool-calling for triage classification. Returns SSE stream parsed token-by-token on the client.
- **Realtime**: Supabase Realtime subscriptions on `posts`, `likes`, `comments`, `mating_messages`, `notifications`.
- **PWA**: manifest + icons + basic service worker for installability.
- **Security**: zod validation on every form and edge function input; storage RLS policies; vault access via signed `pet_access_grants` rows with expiry; rate-limit AI endpoint per user.

## What you'll need to provide
- **Twilio account + API key** (for phone OTP). I'll request it via the secrets tool when we hit that step. Without it, we ship email + Google only and add phone later.
- A few sample pet photos and product images would help seed the demo (optional — I'll use placeholders otherwise).

## Build sequence
1. Design system tokens + bottom nav shell + auth + onboarding.
2. Pet profiles + health vault + vault access QR.
3. Social feed (posts, stories, likes, comments, realtime).
4. AI assistant edge function + chat UI + emergency triage handoff + consult records.
5. Mating listings + chat + digital agreement + puppy listings.
6. Service marketplace (providers, bookings, walk tracking, reviews).
7. Shop + cart + checkout stub + missing-pet alerts + adoption/insurance/grooming entry points.
8. Admin panel + moderation + financial/analytics dashboards.
9. PWA polish, empty states, seed demo data.

This is a large build. After you approve, I'll execute it in stages and check in between major milestones so you can review.
