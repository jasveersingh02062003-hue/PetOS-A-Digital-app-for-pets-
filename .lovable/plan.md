# Resume Plan — Phase 24: Shop Reorder Reminders

Per `PROGRESS_REPORT.md`, the next deliverable is **Phase 24 (Shop reminders)** — P0, no Stripe Connect needed, direct revenue lift. Single phase, fully wired end-to-end, no overlap with shipped work.

## Status recap (already done — do not redo)
Shipped: Phases 16, 17, 18, 19, 20, 21, 22, 23, 25, 27.
Pending after this: 26 (Pet taxi), 28 (Stripe Connect → unblocks 29–32), 33–37.

## What ships in this phase

A user can tap **"Remind me to reorder"** on any shop product, choose a cadence (e.g. every 30 days for food, 60 for litter), and receive a push + in-app `proactive_alert` 3 days before depletion with a one-tap "Reorder now" deep link to `/shop?q=<product>`.

## Scope (no overlap)

```text
DB (new):
  shop_reminders(
    id uuid pk,
    user_id uuid not null,
    product_id uuid references shop_products,
    pet_id uuid null references pets,
    cadence_days int not null check (cadence_days between 7 and 180),
    next_run_on date not null,
    last_notified_on date null,
    active boolean default true,
    created_at timestamptz default now()
  )

RLS:
  - owner-only SELECT/INSERT/UPDATE/DELETE on user_id = auth.uid()

Trigger:
  - tg_shop_reminder_set_next_run: on INSERT, if next_run_on null
    → set to current_date + cadence_days - 3 (lead-time)
  - on UPDATE of cadence_days → recompute next_run_on from last_notified_on

Edge function:
  - shop-reorder-scan (no JWT, cron-only):
    SELECT due reminders where next_run_on <= current_date AND active
    For each → insert into proactive_alerts (kind='shop_reorder',
       deep_link='/shop?q=<product_name>', severity='info')
       → call send-push
       → set last_notified_on = current_date,
         next_run_on = current_date + cadence_days

Cron:
  - shop-reorder-scan-daily @ 07:00 IST

UI:
  - src/components/shop/ReorderReminderButton.tsx
      → opens dialog: cadence preset (15/30/45/60/90 days) + custom + optional pet link
  - Mounted on Shop product card and Shop detail (Shop.tsx)
  - New page: src/pages/ShopReminders.tsx at /shop/reminders
      → list user reminders, edit cadence, pause/resume, delete
  - Settings → "Shop reminders" link entry
  - Reuses existing ProactiveAlertsCard on Home (no new surface needed)
```

## Files to create
- `supabase/migrations/<ts>_phase24_shop_reminders.sql`
- `supabase/functions/shop-reorder-scan/index.ts`
- `src/components/shop/ReorderReminderButton.tsx`
- `src/pages/ShopReminders.tsx`

## Files to edit
- `src/pages/Shop.tsx` — mount `ReorderReminderButton` on product rows
- `src/App.tsx` — register `/shop/reminders` route
- `src/pages/Settings.tsx` — add "Shop reminders" entry with Bell icon

## Acceptance criteria
1. User can create a reminder from any shop product → row appears in `shop_reminders`.
2. Cron job `shop-reorder-scan-daily` is registered and visible in `cron.job`.
3. Manually invoking `shop-reorder-scan` for a due reminder inserts a `proactive_alerts` row + sends push.
4. `/shop/reminders` lists, edits, pauses, deletes reminders.
5. Deep link from alert opens `/shop?q=<product>` (already supported).
6. RLS verified: a second user cannot read/modify another user's reminders.

## Out of scope (explicitly)
- Auto-creating Stripe subscriptions for recurring orders (that's Phase 32, gated by Phase 28).
- Auto-detecting depletion from `nutrition_logs` weight math (deferred — keep this phase small; current cadence is user-set).
- Pet taxi (Phase 26) and Stripe Connect (Phase 28) come **after** this in the queue.

## After this phase
Per the report's priority order, the next two are:
1. **Phase 26 — Pet taxi** (P1)
2. **Phase 28 — Stripe Connect onboarding** (P0, unblocks 29–32)

Approve to ship Phase 24 now.
