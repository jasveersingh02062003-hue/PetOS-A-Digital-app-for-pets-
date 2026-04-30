## Problem

From the screenshots, a buyer who already saved preferences gets re-prompted with the buyer questions every time they open `/onboarding`, and the **Back** button on the preferences screen does not return them to the **Account type** picker.

Two root causes in the code:

1. **`src/pages/Onboarding.tsx`** — the resume effect only short-circuits to the "done" screen for **pet parents who have pets**. For a buyer (or any other role), even after `profiles.onboarded = true` is set by `BuyerPrefs.save`, opening `/onboarding` falls through to `ROLE_OPTIONS.find(...).nextStage`, which sends the buyer back to `BuyerPrefs` and asks the same questions again.
2. **`src/pages/onboarding/BuyerPrefs.tsx`** — the Back button calls `nav(-1)` (browser history back), which often returns to the previous app screen (Profile, Auth, Dashboard) instead of the role-picker stage of onboarding.

A third smaller issue: the Done screen's primary CTA for buyers already says **"Browse adoptions"** and routes to `/mates?tab=adopt`, so the user's request "I should be able to go to the buy section" is already wired — they just never reach Done because of issue #1.

---

## Fix 1 — Stop re-asking buyer (and any role) questions after onboarding

**File:** `src/pages/Onboarding.tsx` (resume effect, lines 89–118)

Add an `isOnboarded` short-circuit before the role-flow router:

```ts
const isOnboarded = (profile as any)?.onboarded === true;
...
if (stageParam) return;            // explicit stage wins
if (!hasIdentity) return;
if (isOnboarded) {                 // NEW
  setStage("done");
  return;
}
if (!accountType) { setStage("role"); return; }
...
```

Effect: once any user (buyer, provider, vet, rescuer, breeder, org, parent) has finished their flow, visiting `/onboarding` shows the "You're all set" screen instead of re-running the role questionnaire. PostAuth already routes fully onboarded users away from `/onboarding`, so this is purely a safety net for the manual visit case shown in the screenshot.

## Fix 2 — Back button on Buyer Preferences returns to Account type

**File:** `src/pages/onboarding/BuyerPrefs.tsx` (lines 102–107)

Replace `nav(-1)` with explicit navigation to the role picker:

```tsx
<button
  onClick={() => nav("/onboarding?stage=role", { replace: true })}
  ...
>
  <ArrowLeft className="h-4 w-4" /> Back to account type
</button>
```

Effect: from buyer prefs, **Back** always lands on the role picker, regardless of how the user got to the page.

## Fix 3 — Question quality for buyers (already correct, no code change)

The current buyer questions are: Species (multi), Breed, City, Budget range, Living situation, Experience, Time available daily, Purpose. These are the right questions for matching adoption/breeder listings, all marked optional, and the screen makes that clear ("All optional — you can change these later"). No edits needed; the user's complaint was driven by the duplicate-prompt bug, not the questions themselves.

---

## Out of scope

- The same `nav(-1)` Back pattern likely exists on `RescuerProfile`, `BreederProfile`, `OrgOnboarding`, and `vet/Onboarding`. I will **not** touch those in this pass — the user explicitly reported the buyer flow. We can do a sweep in a follow-up if desired.
- No database changes.
- No new components.

## Verification

1. Sign in as the buyer shown in the screenshot, open `/onboarding` → should land on **You're all set** with "Browse adoptions" CTA, not the questionnaire again.
2. Click **Browse adoptions** → lands on `/mates?tab=adopt`.
3. Sign up fresh as a buyer → questionnaire shows once → Back goes to Account type → finishing prefs lands on Done screen.