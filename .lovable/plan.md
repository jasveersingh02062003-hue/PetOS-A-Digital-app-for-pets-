# Round 1 — Plumbing & Identity (real, end-to-end)

Every change in this round is wired to live Supabase data — no UI-only stubs. After this round, a breeder/shelter/zoo can sign up, finish onboarding without being forced through the pet wizard, and appear everywhere (feed, comments, stories, notifications, search) with their org name, org logo, role-tinted ring, and an auto-flipping verified tick.

---

## What's already done (verified in audit)

- `AccountTypeChooser` already routes correctly: `provider → /onboarding/provider`, `buyer → /onboarding/buyer-prefs`, org roles → `/onboarding/org`, `pet_parent`/`rescuer` → `/onboarding/add-pet`.
- `FirstRunGate` and `PostAuth` already skip the pet requirement for non-pet-parent roles.
- `AuthorIdentity` exists and is used inside `PostFeed` and `CommentSheet` with role-tinted rings.
- All seven role dashboards (`PetParentHome`, `BreederHome`, `ShelterHome`, `KennelHome`, `GaushalaHome`, `BuyerHome`, `ZooHome`) are live-data backed.

## Real gaps this round closes

1. `/onboarding` (the legacy 7-step wizard) still assumes pet_parent and unconditionally inserts a `pets` row. A breeder/shelter who lands there directly (deep link, refresh) gets blocked. → Add a role guard at the top.
2. `AuthorIdentity` shows the *personal* `full_name` for org accounts. Posts by a shelter should appear under "Happy Paws Shelter" with the shelter logo, not the admin's personal name.
3. `StoryRail`, `NotificationBell`, `Notifications` still render `<Avatar>` manually — no role ring, no verified tick.
4. The verified tick only refreshes on a 5-min stale window. When an admin approves an org, the user keeps seeing the unverified badge until refetch. → Realtime subscription invalidates immediately.
5. `ContextualFab` and `UserProfile` still ignore `account_type`.

---

## Tasks

### A. Onboarding role guard *(real)*

File: `src/pages/Onboarding.tsx`

- At mount, read `profile.account_type`. If it is anything other than `pet_parent`, immediately `navigate('/onboarding/account-type', { replace: true })` so the user lands on the proper org/provider/buyer flow instead of a pet wizard that would error on the pet insert.
- Acceptance: signing up a breeder, deep-linking `/onboarding`, and refreshing all land on the role chooser, not the pet wizard.

### B. Org-as-author identity *(real)*

New file: `src/hooks/useOrgIdentities.ts`

```ts
// One shared cached query returning Map<user_id, { org_name, logo_url, status }>
// Pulls from org_profiles (user_id, org_name, facility_photos[0] as logo, status).
// staleTime 5min, gcTime 30min — same pattern as usePublicProfiles.
```

Edit `src/components/AuthorIdentity.tsx`:

- Call `useOrgIdentities()`. If `accountType` is one of `breeder | kennel | shelter | sanctuary | zoo` AND an org row exists for `userId`, override `name` with `org_name` and `avatar` with the org's first facility photo. Personal name moves to a small `subline` ("Managed by Asha").
- For `pet_parent | buyer | rescuer | provider | vet`, behavior is unchanged.

Acceptance: a post made by a verified shelter shows the shelter's name and logo across feed, comments, notifications, search.

### C. Identity sweep into notifications & stories *(real)*

Files:
- `src/components/NotificationBell.tsx` — replace inline avatar/name with `<AuthorIdentity userId={actorId} size="sm" showBadge={false} />` for the actor of each notification preview.
- `src/pages/Notifications.tsx` — same treatment in the row layout. Group headers untouched.
- `src/components/social/StoryRail.tsx` — replace the bespoke avatar render with `<AuthorIdentity userId={story.user_id} size="sm" showBadge={false} linkTo={false} />` inside the existing scroller. Preserve the gradient-border "unseen" indicator by wrapping AuthorIdentity in the existing ring container (AuthorIdentity's role ring stays as the inner accent).
- Verify that no carousel/grid (Mates/Adopt/Missing) breaks — these were intentionally left alone last round and are not in scope here.

Acceptance: opening Notifications shows role-tinted rings + verified ticks for breeders/shelters; story rail shows them too.

### D. Verified-tick realtime auto-flip *(real)*

Files:
- `src/hooks/useVerifiedOrgs.ts` — add a `useEffect` (inside a small wrapper component or via a top-level subscriber in `App.tsx`) that subscribes to `postgres_changes` on `org_profiles` filtered by `status=eq.approved`, and calls `qc.invalidateQueries({ queryKey: ['verified-orgs'] })` plus `['org-identities']` on every event.
- `src/App.tsx` — mount a single `<RealtimeBridge />` component (new file `src/components/RealtimeBridge.tsx`) inside the auth-aware tree so the subscription runs once per session and is cleaned up on unmount.

Migration (required to make realtime fire on `org_profiles`):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.org_profiles;
ALTER TABLE public.org_profiles REPLICA IDENTITY FULL;
```

Acceptance: with two browser windows open (admin + user), an admin approving the org flips the user's badge to verified within ~1s, no refresh needed.

### E. Sanity pass on existing flows

Quick read-only verification — no code unless something is broken:

- `PostAuth` correctly routes new breeder signups to `/onboarding/account-type` (it already does via the `incomplete` branch + AccountTypeChooser).
- `OrgOnboarding` writes `org_profiles` with `status='pending'` and surfaces in `/admin/orgs`.
- `useProfile` selects `account_type` so `Home.tsx` switch resolves on first render.

If any of these is missing, fold the fix into Task A or B as a single-line edit; otherwise leave alone.

---

## Out of scope for this round (explicit)

To keep scope tight and shippable, these stay for later rounds as already agreed:

- **Round 2:** Search entity-type tabs + `/discover` role chips.
- **Round 3:** Role-aware `UserProfile` (banner, conditional tabs).
- **Round 4:** Role-aware `ContextualFab` actions.
- **Round 5:** Video post type (storage migration, MIME handling).

---

## Technical notes

- `org_profiles.facility_photos` is a `text[]`. Use `facility_photos?.[0] ?? null` as the org logo. If empty, `AuthorIdentity` falls back to the person's avatar.
- The new `useOrgIdentities` hook intentionally returns a `Map<string, OrgIdentity>` (not an array) so `AuthorIdentity` is O(1) per render — same shape as `useVerifiedOrgs` returning a `Set`.
- Realtime channel name: `verified-orgs-watch`. Use a single subscription, not one per component.
- No RLS changes needed: `org_profiles` already exposes `user_id, org_name, facility_photos, status` to authenticated reads via the existing public-org policy.
- No new tables, no destructive migrations. Only the publication add for realtime.

## Deliverables

- `src/hooks/useOrgIdentities.ts` (new)
- `src/components/RealtimeBridge.tsx` (new)
- Edits: `Onboarding.tsx`, `AuthorIdentity.tsx`, `useVerifiedOrgs.ts`, `NotificationBell.tsx`, `Notifications.tsx`, `social/StoryRail.tsx`, `App.tsx`
- One migration: add `org_profiles` to `supabase_realtime` publication.

Reply **"go"** to execute Round 1 end-to-end.
