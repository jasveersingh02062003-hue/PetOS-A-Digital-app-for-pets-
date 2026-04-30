## Goal

Close the four onboarding "trapdoors" that currently break flows for Vets, Service Providers, and Independent Rescuers. Each fix is isolated to a single file and has zero overlap with the others.

---

## Fix 1 — Add Veterinarian to the role picker

**File:** `src/pages/Onboarding.tsx`

- Extend the `RoleChoice` union (line 42–44) to include `"vet"`.
- Extend the `Stage` union (line 46–48) to include `"vet"`.
- Add a new entry to `ROLE_OPTIONS` (line 50–60):
  - `value: "vet"`, title: "Veterinarian", sub: "I treat pets professionally", Icon: `Stethoscope` (lucide-react), `nextStage: "vet"`.
- In the stage router (the block that renders the chosen stage component), when `stage === "vet"`, do `nav("/vet/onboarding", { replace: true })` inside a `useEffect` so the user is sent to the dedicated vet flow instead of staying on `/onboarding`.

This is the only change in this file. No other roles are touched.

---

## Fix 2 — Mark profile onboarded when Vet finishes

**File:** `src/pages/vet/Onboarding.tsx`

- In the `submit` function (around line 58–83), after the successful `vet_profiles` upsert and before `nav("/vet")`, add:
  ```ts
  await supabase.from("profiles").update({ onboarded: true } as any).eq("id", user.id);
  ```
- Wrap in the existing error guard so a failed update surfaces a toast but still lets the user proceed.

No UI changes. No other field changes. The `vet_profiles.onboarded` column stays as-is.

---

## Fix 3 — Mark profile onboarded when Provider submits docs

**File:** `src/pages/onboarding/provider/Wizard.tsx`

- In the mutation's `mutationFn` (just before `return providerId;` at line 119), or inside `onSuccess` before `nav("/provider")` at line 123, add:
  ```ts
  await supabase.from("profiles").update({ onboarded: true } as any).eq("id", user.id);
  ```
- Use the `mutationFn` location so the write is awaited inside the mutation lifecycle and any error is caught by `onError`.

No other behavioural change. Verification status on `service_providers` remains independent and continues to gate listing creation later.

---

## Fix 4 — Lightweight path for Independent Rescuers

**File:** `src/pages/Onboarding.tsx` only (already routes rescuer to a dedicated stage).

Current state: `ROLE_OPTIONS` already maps `rescuer → nextStage: "rescuer"` (line 54), and the stage router already loads `RescuerProfile` for that stage. The earlier concern about rescuers being forced into `OrgOnboarding` is **already resolved** by this mapping — only `shelter` still routes to the org/rescuer stage and `sanctuary`/`zoo` route to `org`.

Action: **verify only**, no code change needed for rescuer routing. As part of this plan I will:
- Re-read the stage switch in `Onboarding.tsx` to confirm `stage === "rescuer"` renders `<RescuerProfile />` and not `<OrgOnboarding />`.
- If (and only if) the switch still falls through to org for rescuer, add an explicit branch rendering `<RescuerProfile />`.

This keeps Fix 4 scoped to a one-line guard at most, with no overlap with Fixes 1–3.

---

## Out of scope (deferred, not part of this plan)

- Verification gating on listing creation.
- 30-day handle change cooldown.
- Role-based avatar rings and post restrictions.
- Any redesign of vet/provider wizards themselves.

---

## Verification steps after implementation

1. Sign up fresh → pick "Veterinarian" → confirm redirect to `/vet/onboarding`, complete it, confirm landing on `/vet` and that re-opening `/onboarding` no longer loops.
2. Sign up fresh → pick "I offer pet services" → pick a category → submit docs → confirm landing on `/provider` and no loop on `/onboarding`.
3. Sign up fresh → pick "Independent rescuer" → confirm `RescuerProfile` screen appears (not the org docs upload).
4. Existing pet parent / buyer / org flows unchanged.