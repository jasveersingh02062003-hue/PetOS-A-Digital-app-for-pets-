## Merge B — Legal pages, disclaimers, auth flow polish

Merge A (DB security/integrity) shipped successfully. Now landing the user-facing pieces.

### Files to create

1. **`src/components/LegalLayout.tsx`** — shared wrapper for legal pages: title, last-updated, footer cross-links, prose styling.
2. **`src/components/MedicalDisclaimer.tsx`** — single source of truth for the calm "Petos AI gives general guidance, not a diagnosis" disclaimer. Two variants: `soft` (boxed, with icon) and `inline` (one-line).
3. **`src/pages/legal/Terms.tsx`** — plain-English Terms (beta status, no-medical-substitute, account rules, content licence, marketplace pass-through, Plus pre-launch).
4. **`src/pages/legal/Privacy.tsx`** — DPDP Act 2023 aligned (what we collect, why, who sees, AI processing, user rights, grievance officer email).
5. **`src/pages/legal/Refunds.tsx`** — beta = no charges; future Plus 7-day refund, marketplace pass-through, vet SLA auto-refund.
6. **`src/pages/ForgotPassword.tsx`** — `/forgot-password`, email entry → `supabase.auth.resetPasswordForEmail` with `redirectTo: /reset-password`. Confirmation state.
7. **`src/pages/ResetPassword.tsx`** — `/reset-password`, listens for `PASSWORD_RECOVERY` auth event, calls `supabase.auth.updateUser({ password })`.

### Files to edit

8. **`src/pages/Auth.tsx`**:
   - Remove the Google OAuth button (no Google account in scope this round).
   - Add a required "I agree to Terms & Privacy" checkbox on the signup tab, links to `/legal/terms` and `/legal/privacy`.
   - Handle `email_not_confirmed` error: show "Check your inbox to verify" state + "Resend verification email" button (calls `supabase.auth.resend({ type: 'signup', email })`).
   - On signup success, show "Check your inbox" state instead of jumping to onboarding (since email verification is on by default).
   - Add "Forgot password?" link under the sign-in form.
   - Footer "By continuing…" line links to actual `/legal/*` routes.

9. **`src/App.tsx`** — add 5 new public routes: `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/forgot-password`, `/reset-password`.

10. **`src/pages/AiChat.tsx`** — render `<MedicalDisclaimer variant="soft" />` once near the top of the chat surface. Also surface remaining-quota indicator using the new RPC error response (`429` with `resets_at`) — show "2 of 3 free chats left this month" sourced from a small head request, or render the toast on tier-limit response. (Minimal change: just toast the new copy when `code === "tier_limit"`.)

11. **`src/pages/VetConsult.tsx`** — `<MedicalDisclaimer />` near the top.

12. **`src/pages/Health.tsx`** — `<MedicalDisclaimer variant="inline" />` in the symptom logger card.

13. **`src/pages/Profile.tsx`** — small footer block linking to `/legal/terms`, `/legal/privacy`, `/legal/refunds`.

### Out of scope this round (matches the master plan)

- Google OAuth (you said no Google account).
- Stripe / Razorpay payments (you said no Stripe).
- Account deletion UI page (table + cascade FKs already in place from Merge A — UI lands in Merge C alongside error logging and admin pages).

### Definition of done

- Five new public routes load on mobile (393px) without needing auth.
- Signup is blocked until the terms checkbox is ticked.
- Forgotten-password flow works end-to-end.
- AI chat, vet consult, and health screens display the calm disclaimer.
- No Google button visible.

Approve and I'll write all 13 files in one batch, then move to **Merge C** (account-deletion UI, in-app error log viewer at `/admin/errors`, client error boundary that writes to `error_log`).
