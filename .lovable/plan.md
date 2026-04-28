# Merge C — Final Production Readiness

This is the last merge before Petos is ready for an invite-only soft launch. It closes the remaining P0/P1 items from the audit: account lifecycle (DPDP Act compliance), in-app observability, and a global crash safety net.

## What this merge ships

### 1. Account deletion (DPDP Act 2023 requirement) — P1
- New edge function `delete-account` (verify_jwt = true) that:
  - Verifies the caller's JWT and re-checks identity
  - Logs to `deletion_log` (user_id, email_hash, reason, timestamp) before destruction
  - Deletes from `auth.users` using the service-role key — the existing `ON DELETE CASCADE` chain (added in Merge A) wipes profiles, pets, posts, vault docs, etc.
  - Returns 200, then client signs out
- New page `src/pages/DeleteAccount.tsx` with:
  - Hard warning copy (irreversible, X days of data lost, list of what's removed)
  - Type-to-confirm input ("delete my account")
  - Optional reason textarea
  - Final confirm button → calls edge function → signs out → redirects to `/`
- Link added to `Profile.tsx` under a "Danger zone" section

### 2. Global error boundary + client error logging — P0
- New `src/components/ErrorBoundary.tsx` (React class component) wrapping the app in `App.tsx`
  - Catches render errors, shows a calm fallback ("Something went wrong. We've been notified.")
  - Inserts the error into `error_log` (source='client', route, message, stack, user_id)
  - "Try again" button resets the boundary; "Go home" navigates to `/`
- New helper `src/lib/logError.ts` — small utility for non-render errors (try/catch in event handlers, mutations) to also write to `error_log`
- Wire into the existing react-query `QueryClient` `onError` defaults so failed mutations get logged

### 3. In-app error log viewer — P1
- New page `src/pages/admin/Errors.tsx` at route `/admin/errors`
  - Gated by `has_role('super_admin')` or `has_role('moderator')` — non-admins see "Not authorized"
  - Lists last 200 errors from `error_log`, newest first
  - Filters: source (client/edge), route, time range (24h/7d/30d)
  - Row expands to show full stack + meta JSON
  - Cursor pagination on `created_at`

### 4. Edge function error logging — P0
- New helper `supabase/functions/_shared/logError.ts` that any function can import to write to `error_log` with `source='edge:<fn-name>'`
- Wire it into the catch blocks of the highest-risk functions only:
  - `chat`
  - `process-notification-jobs`
  - `vault-view`
  - `vaccination-reminders`
- Strips obvious PII (emails, phone numbers via regex) before storing the message

### 5. Pagination defaults — P1
- Update React Query default options in `App.tsx`:
  - `staleTime: 30_000`, `gcTime: 5 * 60_000`
  - Global `onError` → `logError`
- Add cursor pagination (limit 30, "Load more" button) to:
  - `src/pages/Notifications.tsx`
  - `src/pages/MissingDetail.tsx` sightings list
  - `src/pages/Orders.tsx` (if list view exists)

### 6. Vaccination reminders cron sanity check — verification only
- The audit confirmed `vaccination-reminders-daily` is scheduled. We add a `last_run_at` row to a small `cron_health` table updated on every run, and surface "Cron last ran: X ago" on `/admin/errors`. Lets you spot a stalled cron without leaving the app.

## Files to create

- `supabase/functions/delete-account/index.ts`
- `supabase/functions/_shared/logError.ts`
- `src/components/ErrorBoundary.tsx`
- `src/lib/logError.ts`
- `src/pages/DeleteAccount.tsx`
- `src/pages/admin/Errors.tsx`

## Files to edit

- `src/App.tsx` — wrap in ErrorBoundary, add 2 new routes, update QueryClient defaults
- `src/pages/Profile.tsx` — add "Danger zone" link
- `supabase/functions/chat/index.ts` — wrap catch in logError
- `supabase/functions/process-notification-jobs/index.ts` — same
- `supabase/functions/vault-view/index.ts` — same
- `supabase/functions/vaccination-reminders/index.ts` — same + write to cron_health

## DB migration (one)

- `cron_health` table (singleton row per job_name, `last_run_at`, `last_status`, `last_error`)
- RLS: admin-select only (same pattern as `error_log`)
- One trigger-free design — functions write directly via service role

## What is intentionally NOT in this merge

- **Sentry** — replaced by in-app `error_log` + `/admin/errors`. No external account needed; matches your "no Stripe / no Google" constraint. You can swap in Sentry later by replacing `logError.ts` internals.
- **Push notifications (web push / FCM)** — deferred to v1.1 per audit §11
- **Image moderation API** — relies on the existing reports queue + admin review
- **Block-user feature** — deferred to v1.1
- **Per-IP rate limiting on vault-view** — needs infrastructure primitives the platform doesn't have yet (per the no-rate-limiting directive)

## After this merge

Petos closes every P0 from the audit that doesn't require an external paid service. Status: **ready for invite-only soft launch (≤500 users)**. Run a 2-week beta, monitor `/admin/errors`, then open the gates.

Reply "yes" to ship.