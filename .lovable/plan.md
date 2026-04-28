# Phase 4 — Build Plan (DBs already migrated)

The two database migrations are done (Missing Pets + Subscriptions + tier function + free-tier limits). Now I need approval to write the code. **No live payment yet** — Stripe wires are fully built but read keys/price IDs from secrets you'll paste later. Until then, the Plus page shows a calm "Available soon — join early access" state. Zero scammy patterns.

---

## How the payment placeholder works (what makes this clean, not scammy)

- The `/plus` page shows full pricing cards, perk list, FAQ — looks complete.
- The Upgrade button calls edge function `create-checkout`.
- That edge function checks for `STRIPE_SECRET_KEY` + price ID secrets.
  - **If missing** → returns `{ status: "not_configured" }` → UI shows a calm sheet: *"Petos Plus opens to members in a few days. We'll email you the moment it's live — no charge today."* with a one-tap "Notify me" that just flags `profiles.notify_plus_launch = true`. **No fake checkout. No countdown. No fee. No card collection.**
  - **When you paste the keys** → the same button creates a real Stripe Checkout session and redirects.
- The `stripe-webhook` is fully written, signature-verified, idempotent. The day you paste keys + set up the webhook URL in Stripe, everything works.

---

## Files to create / edit

### Hooks & shared components (4 new)
- `src/hooks/useTier.tsx` — `useTier()` returns `{ tier, status, currentPeriodEnd, cancelAtPeriodEnd }`. 60s cache.
- `src/components/PlusBadge.tsx` — subtle Sparkles + "Plus" pill (used next to names).
- `src/components/TierGate.tsx` — bottom sheet with perks list + "See Plus" / "Not now". No urgency tactics.
- `src/components/MissingCreateSheet.tsx` — the "Coco is missing" flow: photo, geolocation, reward, note, submit.

### Missing Pet (3 pages + 1 strip)
- `src/pages/MissingFeed.tsx` (`/missing`) — local active reports, sorted recency.
- `src/pages/MissingDetail.tsx` (`/missing/:id`) — photo, last-seen, sightings (realtime), "I've seen this pet" + "Mark as found" (owner only).
- `src/pages/MissingNew.tsx` (`/missing/new`) — full-page version of the create sheet (deep link target).
- `src/components/MissingStrip.tsx` — horizontal strip of active local cases for Home.
- Edits:
  - `src/pages/Profile.tsx` — red "Report missing" button under each pet card.
  - `src/pages/Home.tsx` — show `MissingStrip` above the feed when local active reports exist.
  - `src/App.tsx` — add 3 routes.

### Petos Plus (3 pages + 1 settings panel)
- `src/pages/Plus.tsx` (`/plus`) — pricing comparison, monthly/yearly toggle, FAQ. Two CTAs: "Upgrade to Plus" (active when keys configured) or "Notify me when Plus launches" (placeholder mode).
- `src/pages/PlusSuccess.tsx` (`/plus/success`) — celebratory landing after Stripe redirect, polls until `tier='plus'`.
- `src/pages/settings/Billing.tsx` (`/settings/billing`) — current plan, renewal date, cancel / manage (opens Stripe portal when configured, otherwise calm "Contact support" CTA).
- Edits:
  - `src/pages/Settings.tsx` — add Billing row.
  - `src/pages/AiChat.tsx` — wrap `send` in tier check + show TierGate when 5/day exceeded (read counter from DB; the chat function will also enforce server-side).
  - `src/components/PostFeed.tsx` — render `<PlusBadge>` next to author names whose tier is plus (via extended public profile RPC).
  - `src/App.tsx` — add 3 routes.

### Edge functions (3 new + 1 edit)
- `supabase/functions/create-checkout/index.ts` — JWT-validated. Looks up Stripe secret + price IDs. If unconfigured → `{ status: "not_configured" }`. Else creates Checkout Session with `client_reference_id = userId`, returns `{ url }`. Uses Stripe via `npm:stripe@^14`.
- `supabase/functions/stripe-webhook/index.ts` — `verify_jwt = false` (config.toml). Verifies Stripe signature with `STRIPE_WEBHOOK_SECRET`. Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Upserts `subscriptions` via service-role client. Idempotent on `provider_subscription_id`.
- `supabase/functions/billing-portal/index.ts` — JWT-validated. Returns Stripe Billing Portal URL for the user's customer (or `not_configured`).
- Edit `supabase/functions/chat/index.ts` — at the top of every successful auth, increment `usage_counters` (kind=`ai_chat`, today). If `current_tier=free` AND today's count > 5 → return `402 { error: "Daily AI limit reached. Upgrade to Plus for unlimited.", code: "tier_limit" }` *before* spending Lovable AI tokens.
- `supabase/config.toml` — add `[functions.stripe-webhook] verify_jwt = false`.

### Add a `notify_plus_launch` column for the placeholder "Notify me" CTA
Tiny migration: `ALTER TABLE profiles ADD COLUMN notify_plus_launch boolean NOT NULL DEFAULT false;` — RLS already covers it.

---

## Secrets you'll paste later (just three)

When you're ready to go live with payments, you'll add:
1. `STRIPE_SECRET_KEY` — `sk_live_...` (or `sk_test_...` for testing)
2. `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the Stripe webhook settings
3. `STRIPE_PRICE_PLUS_MONTHLY` — the price ID like `price_1NX...` for ₹299/mo
4. `STRIPE_PRICE_PLUS_YEARLY` — the price ID for ₹2,499/yr

Until those exist, the UI shows the "launching soon" state. The moment they appear, payments work — no code changes needed.

The webhook URL you'll paste into Stripe will be: `https://fappyyhsdmybkyrhyutm.supabase.co/functions/v1/stripe-webhook` — I'll show this on the Settings → Billing screen for easy copy when you're configuring.

---

## UX principles I'm following (so it doesn't feel like a scam)

- **No false urgency.** No "Limited offer ends tonight". No countdown timers. No "Only 3 spots left".
- **No card collection before payments are live.** The "Notify me" CTA only flags a boolean — never asks for a card.
- **Honest copy on the placeholder.** *"Petos Plus opens to members in a few days. No charge today."*
- **Calm pricing card.** ₹299/mo and ₹2,499/yr side-by-side. The yearly card has a quiet "Save ~30%" tag — not flashing, not red.
- **Clear receipts and renewal dates.** Settings → Billing shows exactly what's billed when, cancel-anytime in one tap.
- **Server-truth tier.** The `Plus` badge and unlocked features come from the `subscriptions` row only — never from local storage or URL params.
- **Free tier is generous.** Onboarding, social, mating discovery, basic AI, vault — all free forever. Plus is additive.

---

## Order I'll ship in (single build)

1. `useTier`, `PlusBadge`, `TierGate`.
2. Missing Pet sheet, three pages, Home strip, Profile CTA, App routes.
3. Plus page, Success page, Billing settings, Settings row, App routes.
4. Tiny migration: `profiles.notify_plus_launch`.
5. Edge functions: `create-checkout`, `stripe-webhook`, `billing-portal`. Update `chat`. Update `config.toml`.
6. Wire `AiChat` and `PostFeed` to tier.

After this, the only thing left for you to do is paste the four Stripe secrets. Everything else — UX, copy, server logic, webhook handling, badge rendering, gates, missing-pet flow — is done.