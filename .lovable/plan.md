
## Goal

Remove the email verification step. New users sign up with **email + password only** and are immediately logged in. All their data (pets, posts, profile, etc.) continues to be stored against their `auth.users` ID exactly as today — nothing about data storage changes, only the verification gate is removed.

Email verification can be re-enabled later by flipping one setting; no data migration will be needed.

---

## What changes

### 1. Turn OFF email confirmation in Lovable Cloud auth
Use the auth configuration tool to set:
- `enable_confirmations = false` (auto-confirm signups — no verification email, no "Confirm your email" screen)

Result: `supabase.auth.signUp()` returns a **session immediately**, so the user is logged in on the first click.

### 2. Simplify `src/pages/Auth.tsx` signup flow
Current code already has a fallback that signs the user in if no session is returned. With auto-confirm ON, `signUp()` will always return a session, so:
- Keep the existing `signUp` call but remove the now-unnecessary `signInWithPassword` fallback branch (cleaner, one less network call).
- Keep the toast "Welcome to Petos" and redirect to `/post-auth`.
- No UI copy changes needed — there was never a "check your email" screen, so nothing to remove there.

### 3. Keep everything else as-is
- **Forgot password / reset password flow** — stays. This still uses email (sends a reset link). The user said *signup* verification should be removed; password reset is a separate feature and is useful to keep. (If the user wants this removed too, we can do it in a follow-up.)
- **Google sign-in** — stays, unchanged.
- **Signup rate limiter** edge function — stays (protects against bot signups).
- **Profiles table + trigger** — stays. Profile row is still auto-created on signup, exactly as today.
- **All user data tables** (pets, posts, health records, etc.) — no schema changes. Data is already keyed by `auth.uid()` and will continue to be.

### 4. Quietly fix the runtime error blocking onboarding
The current `/onboarding` page is throwing `verifiedOrgs?.has is not a function` (visible in runtime errors). This is unrelated to auth but blocks the signup→onboarding flow we're fixing, so it gets patched in the same pass: ensure `useVerifiedOrgs` returns a `Set` (or guard the `.has()` call) so onboarding renders after signup.

---

## Technical details

**Auth config change (via configure_auth tool):**
```
enable_signups: true
enable_confirmations: false   ← the key change
```

**`src/pages/Auth.tsx` — signup branch becomes:**
```ts
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: fullName } },
});
if (error) throw error;
toast.success("Welcome to Petos");
nav(postAuthTarget, { replace: true });
```

**`src/hooks/useVerifiedOrgs.ts`** — ensure the hook always returns a `Set<string>` (default `new Set()` while loading / on error) so `verifiedOrgs?.has(...)` never blows up.

---

## What the user will experience after this change

1. Open app → tap **Create account**
2. Enter name + email + password → tap **Create account**
3. **Instantly logged in** → goes straight to onboarding/home
4. No email sent, no verification link, no "check your inbox" screen
5. All pets, posts, and profile data save against their account exactly as before

---

## Re-enabling later (for your reference)

When you want verification back, it's a one-line change: set `enable_confirmations = true`. No code or data changes needed at that time.
