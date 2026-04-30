# Health System — Single Implementation Plan

One plan. No overlap. Ordered so each slice ships independently and the cheapest, highest-impact fixes land first. No new AI calls are added — we reuse `ai-symptom-classify`, `chat`, and `ai-health-insights`.

---

## Slice 1 — Emergency wiring (cheap, highest impact)

**Goal:** the emergency vet number we already collect actually gets dialled, everywhere it matters.

- `src/pages/Health.tsx` Symptoms tab emergency banner: replace dead `<a href="tel:">` with the real number from `profiles.emergency_vet.phone`. If empty → button becomes "Add emergency vet" → links to `/settings/emergency-vet`.
- `src/pages/VetTriage.tsx`: when verdict is `severe` (or `moderate` + recommend_vet), render a primary "Call {clinic name}" button using the saved number above the existing "Talk to a vet" button.
- `src/components/EmergencySheet.tsx`: already wired — no change.
- `src/components/health/HealthStatusStrip.tsx`: if no emergency vet saved, show a tiny one-time "Add emergency contact" hint chip.

No DB changes. No new edge functions.

---

## Slice 2 — "Today / This week" daily care card

**Goal:** turn the vault from passive vault → active daily loop.

- New component `src/components/health/DailyCareCard.tsx` mounted at the top of `/health` (above tabs).
- Pure client query that unions, for the active pet:
  - vaccinations with `next_due_on` ≤ today+14
  - parasite preventatives with `next_due_on` ≤ today+14
  - active medication doses due today (after Slice 3 lands; until then show active meds list)
  - last `vital_logs.weight_kg` older than 30 days → "Log weight" CTA
- Each row has a one-tap action ("Mark given", "Log now", "Snooze 1 day").
- Empty state: "All caught up for {pet}".

No DB changes for this slice itself.

---

## Slice 3 — Structured medication schedule + dose tick-off

**Goal:** "frequency = free text" becomes a real schedule with adherence.

DB migration:
- Add to `medication_logs`: `schedule_kind text` (`once_daily | twice_daily | thrice_daily | every_n_hours | as_needed`), `times_of_day text[]` (e.g. `['08:00','20:00']`), `every_n_hours int`.
- New table `medication_doses` (`id, medication_id, pet_id, owner_id, scheduled_at timestamptz, taken_at timestamptz, skipped bool, notes`). RLS: owner of pet can CRUD; care-team vets read.
- Trigger or daily cron `medication-dose-spawn` (new edge fn, scheduled via existing pg_cron pattern) that materialises the next 7 days of doses for every active medication.

UI:
- `MedicationsTab.tsx` add-form: structured schedule picker.
- New `src/components/health/DoseTicker.tsx` inside the med card → today's doses with circular tick / skip.
- DailyCareCard (Slice 2) reads from `medication_doses` for "due today".

`pet-care-reminders` cron updated to push 30-min-before reminders for the next undone dose.

---

## Slice 4 — Photos on symptoms and records

**Goal:** vets can finally see what owners describe.

DB migration:
- Add `photo_paths text[]` to `symptom_logs` and `health_records`.
- Storage: reuse existing `pet-media` bucket (or create `health-media`, private, RLS = owner + care-team vets).

UI:
- New shared `src/components/health/PhotoUploadField.tsx` (multi, max 4, ≤3 MB each, downscaled client-side via existing `uploadImage` lib).
- Wire into `SymptomDialog` and `RecordDialog`.
- Timeline + Vault view render thumbnails inline; click → lightbox.
- `ai-symptom-classify` payload extended to include the first photo URL (model already vision-capable in gateway).

---

## Slice 5 — Vet visit-note write-back + Care Team on /health

**Goal:** care-team vets can append a structured visit note that lands on the timeline; care team is discoverable from /health.

DB migration:
- New table `vet_visit_notes` (`id, pet_id, vet_id, occurred_on, summary, diagnosis, treatment, follow_up_on, attachments text[], created_at`). RLS: vet must be on `pet_care_team`; owner reads.

UI:
- Move `CareTeamCard` to also render on `/health` (collapsed) in addition to `/pet/:id`.
- New page `src/pages/vet/PatientNote.tsx` + entry from vet's care-team patient list → "Add visit note".
- `Timeline.tsx` includes `vet_visit_notes` with a verified "vet" badge.
- DailyCareCard (Slice 2) surfaces follow-ups when `follow_up_on` is near.

---

## Slice 6 — Heat / oestrus cycle (unspayed females) + one-tap weight log

**Goal:** fill the two missing first-class trackers; collapse vitals friction.

DB migration:
- New table `heat_cycle_logs` (`id, pet_id, owner_id, started_on, ended_on, intensity 1-3, notes`). RLS owner-only.

UI:
- New tab "Heat cycle" inside `/health`, only shown when `pet.species='dog'/'cat'` AND `sex='female'` AND `neutered=false`. Mini-form: start date, end date, notes; predicts next cycle as `started_on + avg_interval` (default 180 days, recomputed from history).
- Replace `VitalsTab` add-button menu with: **Quick weight** (number-only sheet, 1 field) + **Full vitals** (existing dialog).

---

## Slice 7 — Score fix, empty-state coaching, badge path, UX polish

**Goal:** kill the silent bugs and the seven empty boxes.

- `HealthStatusStrip.tsx`: drop the `-10 no activity in 3d` penalty until WalkLive feeds `last_activity_on`. Show `Walk` chip only when data exists.
- Each tab in `Health.tsx`: replace "No X recorded" with `EmptyHealthState` component (icon + 1-line tip + primary CTA).
- `vaccination_verified` badge: add an "Earn this" CTA on the pet header → opens dialog explaining "ask a care-team vet to verify"; vet-side `PatientNote` (Slice 5) gets a "Mark vaccinations verified" toggle.
- Tabs strip: add fade-edge gradient + scroll-snap so users see there's more to the right on a 393 px viewport.
- AI Health Insights card: add the same medical disclaimer that lives in chat.
- Insights `cta_link` validated against an allow-list of in-app routes before rendering.

---

## Order, dependencies, what NOT to touch

```text
Slice 1 ── Slice 2 ── Slice 3 ─┐
                               ├─ Slice 5 ─ Slice 7
Slice 4 ───────────────────────┘
Slice 6 (independent)
```

- Slice 2 ships a partial DailyCareCard before Slice 3; it self-upgrades when `medication_doses` exists.
- No changes to: `chat`, `ai-symptom-classify` core logic (only payload extended in Slice 4), `ai-proactive-scan`, `payments-*`, `vault-view`, `health-export-pdf`.
- Reuses existing storage, existing notification pipeline, existing cron infra. No new third-party APIs. No new Lovable AI model spend beyond current per-symptom call.

---

## Technical reference (for the implementer)

| Slice | Tables touched | Edge fns | Files (high-level) |
|---|---|---|---|
| 1 | — | — | Health.tsx, VetTriage.tsx, HealthStatusStrip.tsx |
| 2 | — (read-only) | — | DailyCareCard.tsx, Health.tsx |
| 3 | medication_logs (alter), medication_doses (new) | medication-dose-spawn (new), pet-care-reminders (edit) | MedicationsTab.tsx, DoseTicker.tsx |
| 4 | symptom_logs (alter), health_records (alter), storage policy | ai-symptom-classify (payload only) | PhotoUploadField.tsx, SymptomDialog, RecordDialog, Timeline.tsx |
| 5 | vet_visit_notes (new) | — | CareTeamCard.tsx, vet/PatientNote.tsx, Timeline.tsx |
| 6 | heat_cycle_logs (new) | — | HeatCycleTab.tsx, VitalsTab.tsx |
| 7 | — | — | HealthStatusStrip.tsx, EmptyHealthState.tsx, Health.tsx, HealthInsightsCard.tsx |

Approve this and I'll start at Slice 1.
