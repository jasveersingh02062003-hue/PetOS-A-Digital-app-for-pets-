
# Phase 5 — Close the Loop

Make every promise from the user-journey doc real. Payments stay dormant (you paste the Stripe IDs later); everything else ships now with calm, trustworthy UX.

---

## 1. Petos Plus — "Notify me at launch" path

When `create-checkout` returns `not_configured`, the `/plus` page should not feel broken.

- Replace the "Subscribe" CTA with a calm **"Notify me when Plus launches"** button (sets `profiles.notify_plus_launch = true`, shows a confirmation chip).
- If already opted-in, show "We'll let you know ✓".
- Add a one-line note: *"Plus launches soon. Early users get the first month free."* (no countdowns, no scarcity).
- Keep the pricing UI visible so users see the value.

Once you paste the four Stripe secrets, this auto-flips back to real checkout — no code change.

---

## 2. Paid-feature gates (dormant checkout pattern)

Apply the same `not_configured` pattern across every paid touchpoint from the journey doc. Each one shows a **"Free during Beta"** ribbon today; the moment Stripe is wired, it becomes a real one-time charge.

| Feature | Price | Where | Gate component |
|---|---|---|---|
| Vet consult | ₹199 | `/vet/consult/new` | `PaywallSheet` (one-time) |
| Mating listing publish | ₹299 | `/mates/new` submit | `PaywallSheet` |
| Digital agreement | ₹99 | `AgreementCard` sign | `PaywallSheet` |
| Missing pet listing | ₹499 | `MissingCreateSheet` submit | `PaywallSheet` |

- New shared component: `src/components/PaywallSheet.tsx` — bottom sheet, soft copy ("This helps us keep Petos safe and ad-free"), Beta badge.
- New edge function: `create-one-time-checkout` (mirrors `create-checkout`, returns `not_configured` until secrets exist; Plus users skip the charge automatically).
- Ledger table `payment_intents` (status: `beta_free` | `pending` | `paid`) so we have an audit trail today and historical continuity once payments go live.

---

## 3. Booster reminder (vaccination nudge)

Honors the journey doc's "5 days before" promise.

- Daily scheduled edge function `vaccination-reminders` (cron via `pg_cron`).
- Scans `vaccinations.next_due_on` between today+4 and today+6, calls `notify_user` with a calm message: *"Coco's booster is due in 5 days."*
- De-duped via a small `reminder_log` table (one notif per vaccination row).

---

## 4. Realtime sightings on `MissingDetail`

- Subscribe to `postgres_changes` on `missing_pet_sightings` for the current `missing_pet_id`.
- New sightings slide in with a soft fade; toast "New sighting just reported".

---

## 5. Service provider verification (admin flow)

The `verified` flag exists but no one can flip it.

- Add a **"Verification queue"** card in `/admin` listing unverified `service_providers`.
- One-tap **Verify** / **Reject** (super_admin only via `has_role`).
- Verified badge already renders on provider cards — just light it up.

---

## 6. Plus soft-prompt after 3rd AI chat

- After the 3rd AI message in a rolling 30-day window (read `usage_counters`), show `TierGate` once with copy: *"Loving DogtorAI? Plus gives Coco unlimited chats."*
- Dismissible; never shown again that month.

---

## 7. Pet Card share-to-WhatsApp on celebration

Verify `PetCardShare.tsx` is wired into the onboarding completion screen with a "Share Coco's card" button (uses `navigator.share` with WhatsApp fallback URL).

---

## What you do later (one step)

Paste these four secrets when ready — nothing else changes:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_YEARLY`

Plus a fifth for one-time products once you create them in Stripe:
- `STRIPE_PRICE_VET_CONSULT`, `STRIPE_PRICE_MATING_LISTING`, `STRIPE_PRICE_AGREEMENT`, `STRIPE_PRICE_MISSING_LISTING`

All gates auto-activate. Beta-free continues for any product whose price ID isn't set.

---

## Technical details (for reference)

- `payment_intents` table: `id, user_id, kind (enum), amount_inr, status, provider_session_id, created_at`. RLS: select-own.
- `reminder_log` table: `vaccination_id, kind, sent_at` (composite PK).
- Cron via `pg_cron` + `pg_net` to invoke the reminder function daily at 09:00 IST.
- `PaywallSheet` uses the same calm pattern as `TierGate` — no urgency, no scarcity language.
- Realtime: enable replica identity full + add `missing_pet_sightings` to `supabase_realtime` publication.
- Admin queue uses existing `roles_admin_manage` RLS; no schema change.

---

## What this delivers

A complete, trustworthy app today — Beta-free for all paid touchpoints — that converts to a real payments flow the moment you paste your Stripe IDs. No scammy copy, no fake countdowns, no broken buttons. Every promise from the journey doc is honored.

Approve to build.
