# Close-the-gaps plan (final, no overlap)

A real check first — several "missing" items already have backend or partial code. I'll reuse what exists and only build the missing layers. Five tightly-scoped slices, ordered by impact-per-credit.

## Reality check before building

| Gap | What already exists | What's truly missing |
|---|---|---|
| vaccination_verified earn-path | `pets.vaccination_verified bool` column, `health-export-pdf` & `vault-view` fns | Submit-for-review flow + admin approval UI |
| Insurance round-trip | `insurance_leads` (incl. partner_ref, premium_inr), `pets.insurance_provider/policy`, `insurance-webhook` edge fn | Webhook payload mapping + UI to show active policy + claim button |
| Activity tracking | nothing | **Excluded — user said leave it** |
| Weight goals | `pets.target_weight_kg`, chart goal line, delta badge | **Already shipped last turn** |
| Vet UI to push pharmacy Rx | `PrescriptionBuilder` exists in `AppointmentRoom`, `pharmacy_suggestions` table, customer card | Make it reachable from vet patient view; mark-as-filled status |
| Allergies / chronic as first-class | `pets.allergies[]`, `pets.conditions[]` arrays + ChipGroup picker in PetEditor | Surface them on `/health` (not just settings); pass to AI insights & symptom triage |
| Microchip number | `pets.microchip_id` column | UI field + display on Pet ID card |
| Unit toggles (kg ↔ lb, °C ↔ °F) | `profiles.language` text col | `profiles.unit_system` pref + tiny `useUnits()` hook + format helper |
| Multi-pet aggregate home | per-pet `pet_health_status` view | One "All pets" summary card |
| Tab swipe affordance | horizontal scroll only | Edge fade + scroll-snap |

So only **5 slices of real work** remain.

---

## Slice A — Vaccination verification flow

**Backend**
- New table `vaccination_verification_requests` (pet_id, submitted_by, status enum `pending|approved|rejected`, vet_id reviewer, reviewer_note, photo_paths[], submitted_at, reviewed_at).
- RLS: owner can insert/read own requests; care-team vets can read & update requests for pets they're on; `super_admin` role can review any.
- Trigger: when status flips to `approved`, set `pets.vaccination_verified = true`.

**Frontend**
- "Get verified" button on the Vaccinations tab when `!vaccination_verified` → opens dialog: pick a vet from care-team OR submit for admin review, attach card photos (reuse `PhotoUploadField`).
- New page `/vet/verifications` (vet portal tab) listing pending requests for pets on care team, with Approve / Reject + note.
- Pet header badge becomes the entry point if not yet verified ("Tap to verify").

## Slice B — Insurance round-trip

**Backend**
- Extend `insurance_leads` reads via `insurance-webhook`: on receipt of `{partner_ref, status:"bound", policy_number, premium_inr, expires_on}` → update lead row + write `pets.insurance_provider` and `pets.insurance_policy`.
- New table `insurance_claims` (pet_id, owner_id, lead_id, claim_ref, amount_inr, status, submitted_at, photo_paths[]).

**Frontend**
- `InsuranceCard` shows three states: **none** (current "Get a quote") → **lead pending** (greyed "Quote in progress, partner will email you") → **active** (provider + policy number + "File a claim" button).
- "File a claim" → dialog: amount, description, photo upload → inserts into `insurance_claims`, shows status timeline.

## Slice C — Vet pharmacy Rx workflow

**Backend** — none. `pharmacy_suggestions` already supports it.

**Frontend**
- In `vet/Dashboard.tsx` Patients list: "Open" button currently goes to timeline; add a second action **"Prescribe"** → reuses `PrescriptionBuilder` in a dialog (pass `petId`, `ownerId`, no `appointmentId`).
- Update `PrescriptionBuilder` to accept optional `appointmentId`.
- Customer-side `PharmacySuggestionsCard` already shows them — add a "Mark filled" button that updates `pharmacy_suggestions.status` to `filled` so vet sees confirmation.

## Slice D — First-class allergies, conditions, microchip + multi-pet home

**Backend** — none (columns exist).

**Frontend**
- Pet header card on `/health`: render allergy & condition chips inline under the breed line (read-only). Empty state nudge "Add allergies in pet settings" appears once.
- Add **Microchip ID** field to `PetEditor`; display on the Pet ID dialog and the exported PDF passport.
- Pass `allergies` + `conditions` into `ai-symptom-classify` and `ai-health-insights` prompts so the AI sees them.
- New `/health` "All pets" header strip when user has 2+ pets: one row per pet showing avatar, name, score from `pet_health_status` view, and one urgent-task chip ("Vax due in 3d", "Med dose now"). Tap → switches active pet.

## Slice E — Unit preferences + tab UX polish

**Backend**
- Add `profiles.unit_system text default 'metric'` (`metric` | `imperial`).

**Frontend**
- New `src/hooks/useUnits.ts` returning `{ system, formatWeight(kg), formatTemp(c), parseWeight(input)→kg }`.
- Replace hard-coded `kg` / `°C` strings in `WeightChart`, `VitalsTab`, `QuickWeightSheet`, `DailyCareCard`, `PetEditor`, `HealthStatusStrip` with the helper.
- New row in `Settings → Account`: Units (Metric / Imperial) toggle.
- Tabs strip on `/health`: add left/right gradient fade overlays + `scroll-snap-x` so the next tab "peeks", giving a clear swipe affordance without redesigning navigation.

---

## Out of scope (confirmed)

- **Activity / wearable integration** — explicitly skipped per user.
- Live partner integrations beyond the existing webhook contract (we ship the contract; partners plug in).

## Order of work & credit posture

A → B → C → D → E. Each slice is independently shippable so you can stop at any point. No two slices touch the same file in conflicting ways:

- DB migrations: A (verification table+trigger), B (claims table), E (profiles col). C & D need no migration.
- Shared util: only Slice E adds `useUnits` and refactors call-sites.

Total: **3 small migrations, ~8 new components, ~6 edits to existing files.**
