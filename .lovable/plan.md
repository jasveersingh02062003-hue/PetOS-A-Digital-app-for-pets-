# PetOS — Production Readiness Plan

Goal: take the app from "code complete" to a real, working, industry-grade product real users can use. Payments setup is owner-handled (morning), so this plan covers everything else.

We work in **5 strict phases**, no overlap. Finish each phase before starting the next.

---

## Phase 1 — Backend Security Hardening (CRITICAL — do first)

These are real exploits / data leaks. Must be fixed before any seeding or public test.

1. **Lock down `user_roles` table**
   - Drop the `roles_select_all` policy (currently `qual: true` — anyone can read everyone's roles).
   - Replace with: a user can only read their own roles; admins (via `has_role(...,'super_admin')`) can read all.
   - Verify `has_role()` SECURITY DEFINER function still works for RLS lookups elsewhere.

2. **Fix 3 ERROR-level "Security Definer View" linter findings**
   - Views: `repeat_sellers`, `pet_health_status`, `trending_hashtags`, `profiles_public`, `subject_ratings`, `pets_public`.
   - Recreate each `WITH (security_invoker=on)` so they respect the caller's RLS, not the view-owner's privileges.
   - For views that need to expose public-safe subsets (e.g. `profiles_public`, `pets_public`), keep `security_invoker=on` AND make sure the underlying table's SELECT policy allows the safe public columns OR keep using the SECURITY DEFINER RPC (`get_pets_public`, `get_profiles_public`) and drop the redundant view.

3. **Audit other security-definer functions**
   - List every `SECURITY DEFINER` function in `public`.
   - Confirm each has `SET search_path = public` (prevents search_path hijack).
   - Confirm none accept raw SQL or unsafe input.

4. **Storage bucket policies**
   - Review the 3 public-bucket warnings.
   - For avatar/post-image buckets: keep public read but restrict write to authenticated owner.
   - For private buckets (vault, prescriptions): confirm no public read.

5. **Re-run linter** until zero ERROR-level findings remain. Warnings logged for later.

**Exit criteria:** Linter shows 0 errors. `user_roles` not publicly readable. Re-run `security--run_security_scan`.

---

## Phase 2 — Fix Public Access & Real Bugs

Reality bugs blocking actual users.

1. **Public pet profile reliability** (`/pet/:id`, `/pet/:public_id`)
   - Current `PetProfile.tsx` does direct read first → falls back to `get_pets_public` RPC. Direct read silently returns empty for non-owners (RLS), then RPC scans the whole table client-side.
   - Refactor to a dedicated `get_pet_public_by_id(text)` RPC that takes either id or public_id, returns one safe row, and is fast.
   - Same pattern for `get_profile_public_by_id_or_handle`.
   - Remove unbounded `get_pets_public()` / `get_profiles_public()` calls from hot paths (StoryRail, PostFeed, MissingStrip, PetProfile lineage). Add per-id RPCs.

2. **PWA / manifest / favicon**
   - Fix manifest 401 (serve from `public/manifest.webmanifest` only, no auth header).
   - Add favicon (`public/favicon.ico` + sized PNGs referenced in `index.html`).

3. **React ref warning** in console — track down the function-component-with-ref and forward it or wrap in `React.forwardRef`.

4. **Bred-on-PetOS overlay for non-owners** — currently depends on pet/litter lookup that fails under RLS. Add the litter/sire/dam flag to `pets_public` RPC output so the overlay renders for all viewers.

5. **Health timeline public/private split** — confirm only owner + granted vets see private records; everything else returns empty cleanly (no error toast).

**Exit criteria:** Open `/pet/<id>` in an incognito browser, see the public pet profile load fully. Same for `/u/<handle>`.

---

## Phase 3 — Seed Real Demo Data

Without data, nothing is testable. Create one realistic record per role + cross-linked flows.

1. **Accounts (via auth.users + profiles)**
   - 1 pet parent, 1 buyer, 1 breeder, 1 kennel, 1 shelter, 1 sanctuary, 1 zoo, 1 rescuer (pending), 1 rescuer (verified), 1 vet, 1 walker, 1 taxi, 1 admin.

2. **Org profiles** for the 8 org accounts, with verification status (mix of approved + pending), banners, monthly upkeep (sanctuary), capacity (kennel).

3. **Pets**: 2 per pet parent, 4 breeder pets (linked via sire/dam to demo "Bred on PetOS"), 6 shelter rescues, 3 sanctuary residents, 2 zoo exhibits.

4. **Listings**:
   - 3 breeder pet_listings (with health-test chips).
   - 3 shelter adoption listings (₹0 enforced).
   - 2 mating listings.
   - 4 boarding services.
   - 3 walker/taxi services.

5. **Activity rows**:
   - 1 completed appointment + 1 prescription + vet grant.
   - 1 active service booking + 1 transport booking with route points.
   - 1 paid donation + tax receipt + 1 payment_intent (test mode).
   - 1 rescue journey with 4 stages.
   - 1 kennel daily report.
   - 1 GPS device with recent pings.
   - Posts, comments, likes, follows, wishlists across users.

6. **Seed script** stored as a SQL migration so it can be re-run on fresh environments.

**Exit criteria:** Logged-out user sees a populated feed; every role's home dashboard has real KPIs.

---

## Phase 4 — End-to-End Reality QA

Test every critical flow in the live preview using the browser tool with multiple seeded accounts.

Flows to verify (each: ✅ done / ❌ broken):
1. Sign up → email verify → onboarding → role chooser → first pet → done.
2. Public pet profile (incognito) loads with avatar, posts, lineage, skills, achievements.
3. Public user profile loads in incognito.
4. Feed: posts render, like, comment, save, share, report.
5. Adoption: shelter creates listing → buyer applies → shelter approves → message thread.
6. Marketplace: breeder lists pet → buyer wishlists → buyer messages → repeat-seller warning shows.
7. Mating: pet marked available → another user requests → agreement PDF → payment sheet.
8. Vet: book appointment → join room → open shared vault → drop prescription → grant expires after end.
9. Boarding: kennel creates service → user books → daily report posts → review left.
10. Walker: book → live walk chip in thread → walk session map.
11. Donation: zoo/sanctuary/shelter receives donation → receipt page → tax receipt PDF.
12. Notifications: trigger event (like, follow, booking) → bell badge → list shows it.
13. Rescue journey: shelter posts stage updates → carousel renders publicly.
14. Search & discover: all tabs return seeded results.
15. Settings: edit profile, privacy, notifications, blocked accounts, delete account flow stops at confirm.

For each broken flow: log in `LAUNCH_CHECKLIST.md` with severity, fix in this phase only if blocker; otherwise schedule.

**Exit criteria:** All 15 flows pass. No console errors on critical paths.

---

## Phase 5 — Launch Configuration

Operational setup so real users can actually use it.

1. **Push notifications** — generate VAPID keys, add to secrets, enable `send-push` edge function, wire subscription on first app open.
2. **Email** — configure transactional email domain (signup, password reset, receipts, booking confirmations). Use the email_domain tool.
3. **Auth hardening** — enable HIBP leaked-password check, set OTP expiry to 10 min, enable Google OAuth (already on), add app icons for OAuth screens.
4. **SEO/social** — verify `og-pet`, `og-image`, `sitemap` edge functions return correctly; add robots.txt rules; verify canonical URLs.
5. **Error tracking** — confirm `installGlobalErrorHandlers` writes to `error_logs`; add admin error viewer page check.
6. **Performance** — image processing on uploads (already exists), confirm `image-process` runs; verify lazy-loading on feed.
7. **Legal** — Terms, Privacy, Refunds pages exist — verify links from settings/footer.
8. **Publish** — click Publish in the editor to get a live `.lovable.app` URL; user adds custom domain when ready.

**Exit criteria:** App is published, push works on a real device, signup email arrives in inbox, first real user can complete the buyer journey end-to-end.

---

## Out of scope (owner handles)

- **Payments go-live** (Stripe live keys, payout setup, KYC) — owner does this in the morning. Code is already done.

---

## Technical execution notes

- **Migrations**: every Phase 1 + 2 schema/policy change goes through the migration tool. No raw runtime SQL.
- **Seed data** (Phase 3): inserted via the `psql` insert tool (not migrations) so it's clearly demo-only and can be wiped.
- **Browser QA** (Phase 4): use `navigate_to_sandbox` with seeded account credentials; one flow per session, screenshot the success state.
- **No new features** in this entire plan. Anything not on the PDF checklist is deferred. If a Phase 4 test reveals a missing PDF feature, log it; don't fix in this round unless it blocks a core flow.
- **Order is strict**: never seed before security is fixed (would expose data); never QA before seeding (nothing to test); never launch before QA passes.

---

## Estimated scope per phase

| Phase | Migrations | Code edits | Time relative |
|---|---:|---:|---|
| 1 Security | 4–6 | 0 | small |
| 2 Public access | 2–3 | 4–6 files | small |
| 3 Seed data | 1 (script) | 0 | medium |
| 4 QA | 0 | 0–10 hotfixes | large |
| 5 Launch | 0–1 | 2–3 | small |

After approval I'll start with **Phase 1** and stop at each phase boundary so you can verify before we proceed.
