# Onboarding gap audit — what's real, what's already done, what to build

I went through each of the 8 "gaps" in the reviewer's note against the actual codebase. Here's the honest truth — half of them are already implemented or already handled by existing app surfaces. Only 4 are real, worth building, and worth your time. No overlapping work.

---

## Audit: gap-by-gap reality check

| # | Reviewer's claim | Reality in the codebase | Verdict |
|---|---|---|---|
| 1 | Breed "Other" has no validation | `FirstPetWizard.tsx` already uses `OTHER` sentinel + `breedOther` free-text input + `nextDisabled` when both empty | **Partially real.** Submission is blocked, but no inline message. Tiny polish needed. |
| 2 | Age → vaccine schedule logic missing | `pets_derive_dob` trigger exists, `seed_pet_vaccine_reminders(_pet_id)` RPC exists with dog/cat schedules, gated on `reminder_prefs` opt-in, called from wizard | **Already built.** Only missing piece: a "Recalculate reminders" button on the pet's health page. |
| 3 | No offline handling during onboarding | True — no offline indicator on wizard steps, no IndexedDB draft | **Real, but P3.** Most onboarding happens on Wi-Fi in <3 min. Cost/benefit poor. **Skip for now.** |
| 4 | No way to edit emergency vet later | `src/pages/settings/EmergencyVet.tsx` exists, routed at `/settings/emergency`, `Health.tsx` reads `emergency_vet`, `HealthStatusStrip` shows a CTA when missing | **Already built.** Nothing to do. |
| 5 | No onboarding step analytics | `src/lib/analytics.ts` `track()` exists with consent gating, but **zero `track()` calls inside onboarding components** | **Real.** Cheap to add, big payoff for iteration. **Build.** |
| 6 | No photo compression / loading state | `uploadImageWithVariants` calls `image-process` edge fn which **resizes server-side** (thumb/feed/full). Loading state via `photoUploading` already exists. But the original full-size file still uploads first → slow on large phone photos | **Partially real.** Add a lightweight client-side downscale before upload to cut upload time on 8-12 MB phone photos. |
| 7 | Cross-device session persistence | Not built. URL `?stage=` + DB-backed profile/pets already let a user resume anywhere — if they finish identity on phone, the laptop sees identity done and jumps to the right stage | **Already mostly handled.** Adding an `onboarding_sessions` table for half-typed pet drafts is heavy infra for a rare flow. **Skip.** |
| 8 | Goal → module mapping missing | `PetParentHome.tsx` has `goalToSections` map and `orderedSections` reordering live; "Personalised for" chip strip renders | **Already built.** |

**Net real work: gaps 1 (polish), 2 (recalc button only), 5 (analytics), 6 (client compress).**

---

## What we'll build (P0 → P3, no overlap)

### P0 — Onboarding step analytics (gap 5)
Add `track("onboarding_step", { step, action, ... })` calls at every meaningful junction. So you can finally see *where* people drop off and iterate.

- `IdentityStep` → `started`, `completed` (with avatar uploaded? language picked?)
- Role picker → `role_selected` (which role)
- `FirstPetWizard` → `started`, `submitted` (species, has_photo, age_mode, reminders_on, reminder_kinds, has_emergency_vet)
- `AddAnotherPet` → `add_another_clicked` / `done_clicked`
- `GoalsStep` → `submitted` (goals[], count)
- `Done` → `viewed`, `cta_home_clicked`

All props are non-PII (booleans, enums, counts). Honors existing consent gate automatically.

### P1 — Client-side photo downscale (gap 6)
In `src/lib/uploadImage.ts`, before sending to `image-process`, run a 0-dependency canvas downscale: any image with longest edge >1600px gets resampled to ≤1600px JPEG @ 0.85. Keeps server resize behavior, but cuts a 12 MB iPhone photo to ~400 KB *before* it leaves the device. Same `photoUploading` spinner already shown.

No new npm package — pure canvas, ~30 lines.

### P2 — Breed "Other" inline hint + helper-text polish (gap 1)
- Show a red helper line under the free-text field if user typed nothing and tries to submit.
- Persist as `breed = "Other: <input>"` so future fuzzy matching can detect it. (Today it stores raw, which conflicts with known breed names.)
- Light copy improvement on the breed select.

### P3 — "Recalculate health reminders" action (gap 2 finishing touch)
On `Health.tsx` (per-pet card or top action), add a small button:

> "Recalculate reminders" — confirms, then calls `seed_pet_vaccine_reminders(pet_id)` again.

Already-existing rows guard `IF v_count > 0 THEN RETURN` — so we need a tiny migration: add an `_force boolean default false` parameter that, when true, deletes auto-scheduled rows (matched by the `notes LIKE 'Auto-scheduled%'` marker) and reseeds. Lets users fix wrong-age vaccinations they reported during onboarding.

---

## What we will NOT build (and why)

- **Offline draft persistence (gap 3)** — Onboarding takes 2-3 min, almost always on Wi-Fi after install. IndexedDB drafts add real complexity for a rare edge case. Revisit only if analytics (P0) shows network-related drop-off.
- **Cross-device onboarding sessions (gap 7)** — Already handled by the URL `?stage=` resume + the fact that `profile`/`pets` rows are the source of truth. A separate sessions table only helps for half-typed-but-unsaved pet forms — extremely rare.
- **Edit emergency vet (gap 4)** — Already shipped at `/settings/emergency`.
- **Goal → module mapping (gap 8)** — Already shipped in `PetParentHome.tsx`.

If you want them later, they can be opened as separate scoped tasks.

---

## Files that will change

```text
src/lib/analytics.ts                       (no change — re-use)
src/lib/uploadImage.ts                     (add canvas downscale)
src/components/onboarding/IdentityStep.tsx (track started/completed)
src/components/onboarding/FirstPetWizard.tsx (track + breed-other validation)
src/components/onboarding/GoalsStep.tsx    (track submitted)
src/pages/Onboarding.tsx                   (track role_selected, stage transitions)
src/pages/onboarding/AddAnotherPet.tsx     (track choice)
src/pages/onboarding/Done.tsx              (track viewed)
src/pages/Health.tsx                       (Recalculate reminders button)
supabase/migrations/<new>.sql              (add _force param to RPC)
```

No file is touched twice for unrelated reasons.

---

## Verification plan (manual, after build)

1. Sign up fresh → finish onboarding end-to-end → check `analytics_events` table has rows for: `onboarding_step` with action in {started, role_selected, pet_submitted, goals_submitted, done_viewed}.
2. Upload a >5 MB photo → confirm thumbnail appears within ~1s on a fast connection (compression in action) and `pets.avatar_url` is set.
3. Pick "Other" breed → leave blank → tap Add pet → see inline error, no submission. Type "Maltipoo" → submits as `Other: Maltipoo`.
4. Onboard a 5-year-old dog with vaccines ON → vaccinations table seeded with annual rows starting today. Then on Health page, change DOB to puppy + tap "Recalculate reminders" → old auto-rows replaced.
5. Refresh during goals step → resumes at goals.
6. Re-login → bounces to Home, no re-onboarding.

---

## User journey (final, after this build)

```text
Install ▸ Auth (email or Google)
   │
   ▼
1. Identity      — name, @handle, city, language, units, avatar     [analytics: started → completed]
   │
   ▼
2. Role picker   — Pet parent / Buyer / Provider / Vet / Rescuer…   [analytics: role_selected]
   │  (pet parent path)
   ▼
3. First pet     — basics + health + behaviour + reminders + vet     [analytics: pet_submitted]
       │  on submit: pets row, profile.emergency_vet, reminder_prefs,
       │  seed_pet_vaccine_reminders → real vaccinations rows appear
   ▼
4. Add another?  — yes → loop step 3 (additional mode, no vet/reminders)
   │             — no  → continue
   ▼
5. Goals         — multi-select with live preview                    [analytics: goals_submitted]
       │  on submit: profile.goals + onboarded=true
   ▼
6. Done          — confetti, summary card, "Open Home"               [analytics: done_viewed]
   │
   ▼
Home (PetParentHome)
   • "Personalised for [Vet help] [Social] [Mates]" chip strip
   • Sections reordered to put goal-relevant modules on top
   • Hero pet card with real DOB, vaccine reminder due in Notifications
   • Emergency vet one tap away in Health tab
```

Approve and I'll implement P0 → P3 in order, verify each, and report back with the analytics rows visible in the DB.
