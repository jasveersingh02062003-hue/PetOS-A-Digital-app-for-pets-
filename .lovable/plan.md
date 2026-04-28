# Petos — Master Spec Audit & Next Slice

I read the master prompt as the source of truth and audited the current codebase against it. Here is exactly where we stand and what I'll build next.

---

## Audit: Spec vs. Reality

### Already live (✅)
- Auth (email + Google), email verification required
- Onboarding flow (species → breed → name → DOB → weight → photo → goals → vaccine → celebration with Pet Card share)
- Home (greeting, stories rail, missing strip, composer, feed)
- Health (vaccinations, vault, weight)
- DogtorAI chat with pet context, markdown, 3-chat soft-gate
- Discover (trending / latest / mates), vaccine-gated mates grid
- Services (list, booking, reviews) + Vet (apply, consult, prescriptions)
- Mates (list, request, signed agreement via PaywallSheet)
- Missing Pet (feed, detail with realtime sightings, create with PaywallSheet)
- Shop, Cart, Orders
- Profile + Settings (pets, privacy auto-off-if-neutered, notifications, billing, emergency vet, about you, goals)
- Petos Plus page + Billing + dormant Stripe (`create-checkout`, `create-one-time-checkout`, `stripe-webhook`)
- Admin queue for verifying providers
- `payment_intents`, `reminder_log`, `usage_counters` tables; RLS; `user_roles` + `has_role()`
- Vaccination reminders edge function on daily cron

### Gaps against the spec (🟡 / 🔴)

1. 🔴 **Plus dormant CTA copy** — `/plus` still shows "Subscribe" wording paths in places; needs the calm "Notify me when Plus launches" with `profiles.notify_plus_launch` confirmation chip when checkout returns `not_configured`.
2. 🔴 **`profiles.notify_plus_launch` column** — referenced by spec, not in schema yet.
3. 🟡 **Beta ribbon consistency** — `PaywallSheet` shows it; verify every entry point (vet consult, mating publish, agreement, missing alert) actually opens the sheet and never a broken/empty state.
4. 🟡 **DogtorAI streaming + tool calls** — chat works but is not streamed and has no agent tools (`book_vet_consult`, `log_symptom`, `find_nearest_vet`, `add_reminder`).
5. 🟡 **Emergency SOS** — `EmergencySheet` exists; verify it surfaces the user's saved emergency vet + nearest 24×7 option with one-tap call.
6. 🟡 **Missing Pet WhatsApp poster** — share exists for Pet Card; missing-pet detail needs a "Share poster to WhatsApp" action with a generated image/text.
7. 🟡 **Empty / loading / error states** — spot-check each list page; replace any spinners with skeletons and add a one-line empty state.
8. 🟡 **Tone pass** — sweep all CTAs and toasts for any "Buy now", "Hurry", urgency, or scammy phrasing; rewrite to the calm voice.
9. 🟡 **Accessibility** — verify 44px tap targets and aria-labels on all icon-only buttons (NotificationBell, ComposerButton icon variant, BottomNav).
10. 🟡 **Mobile 393px QA** — visual pass on Home, Discover, Health, Vet, Mates, Missing, Plus.

### Out of scope for this slice (acknowledged, deferred)
- Real Stripe activation (waits for user to paste secrets)
- DogtorAI streaming + tool-calls (own slice — meaningful surface area)
- Family sharing under Plus
- Map view in Services (currently list only)

---

## This Slice — "Calm, Trustworthy, Beta-Ready"

Goal: lock in the dormant-payments promise + brand tone everywhere, so the app feels finished today and flips to paid the instant Stripe keys are pasted.

### 1. Plus dormant flow (copy + DB)
- Migration: add `profiles.notify_plus_launch boolean default false`.
- `Plus.tsx`: when `create-checkout` returns `not_configured`, swap CTA to **"Notify me when Plus launches"**. On click → update `profiles`, show "We'll let you know ✓" chip. If already opted-in, render the chip on load.
- Keep the price cards visible (value stays clear). Add one calm line: *"Plus launches soon. Early users get the first month free."* No timers.

### 2. Beta-free sweep (UX integrity)
- Walk every paid entry point and verify `PaywallSheet` opens and the action completes:
  - Vet consult (`EmergencySheet` + `VetConsult`)
  - Mating publish (`MatesNew`)
  - Agreement sign (`AgreementCard`)
  - Missing alert (`MissingCreateSheet`)
- Each writes a `payment_intents` row with `status='beta_free'` and proceeds. No error toasts on `not_configured`.

### 3. Missing Pet WhatsApp poster
- On `MissingDetail`, add a "Share poster" button. Generates a text + image link via `navigator.share` with WhatsApp fallback (`https://wa.me/?text=...`). Includes pet name, photo URL, last seen, contact, deep link back to the listing.

### 4. Tone & polish pass
- Search all toasts/buttons/headings for: "Buy", "Subscribe now", "Hurry", "Limited", "!" stacks. Rewrite to the calm voice.
- Replace any remaining spinners with `<Skeleton />`.
- Add one-line empty states to: Notifications, Orders, Vault, Mates, Missing feed.

### 5. Accessibility quick wins
- Add `aria-label` to all icon-only buttons (NotificationBell, ComposerButton icon, BottomNav items, ReportButton).
- Ensure 44×44 minimum touch targets in `BottomNav` and floating actions.

### 6. 393px visual QA
- Walk Home → Discover → Health → DogtorAI → Vet → Mates → Missing → Plus → Settings at the user's actual viewport. Fix any clipping, overflow, or cramped spacing.

---

## Database changes (one migration)

```sql
alter table public.profiles
  add column if not exists notify_plus_launch boolean not null default false;
```

No other schema changes in this slice.

---

## Files I expect to touch

- `supabase/migrations/<new>.sql` — add `notify_plus_launch`
- `src/pages/Plus.tsx` — dormant CTA + opt-in chip
- `src/pages/MissingDetail.tsx` — share-poster action
- `src/components/PaywallSheet.tsx` — verify Beta ribbon copy
- `src/components/EmergencySheet.tsx`, `MatesNew.tsx`, `AgreementCard.tsx`, `MissingCreateSheet.tsx` — verify wiring
- `src/components/BottomNav.tsx`, `NotificationBell.tsx`, `Composer.tsx`, `ReportButton.tsx` — aria-labels + tap targets
- Empty-state passes on `Notifications.tsx`, `Orders.tsx`, `VaultView.tsx`, `MatesGrid.tsx`, `MissingFeed.tsx`
- Tone sweep across pages + components

---

## What you need to do — nothing, until later

When you're ready for real payments, paste these into Cloud secrets and everything flips automatically:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`
- `STRIPE_PRICE_VET_CONSULT`, `STRIPE_PRICE_MATING_LISTING`, `STRIPE_PRICE_AGREEMENT`, `STRIPE_PRICE_MISSING_LISTING`

Note: Lovable now offers **built-in payments** (no Stripe account setup required). When you're ready, I can enable that instead of BYOK Stripe — same dormant pattern, fewer steps for you. Just say the word.

---

Approve to build this slice. After this lands, the natural next slice is **DogtorAI streaming + agent tools** (book vet, log symptom, find nearest vet, add reminder) — that's where the "intelligence" pillar truly comes alive.