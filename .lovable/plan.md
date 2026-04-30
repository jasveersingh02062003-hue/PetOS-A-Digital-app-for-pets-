
## Reality check — Health Vault journey vs shipped code

I read `Health.tsx`, `HealthAlerts.tsx`, `HealthCompare.tsx`, `EmergencyBanner.tsx`, `MultiPetSummary.tsx`, `useUnits.ts`, `WeightChart.tsx`, `QuickWeightSheet.tsx`, `VitalsTab.tsx`, `PetEditor.tsx`, `health-export-pdf`, `vet-grant-create`, `vault-view`, `useHealthAlerts.ts`. Verdict below — only **7 small gaps** remain.

### What is already shipped (no work needed)

| Journey claim | Status |
|---|---|
| Empty-state "Add a pet to begin" card | ✅ Health.tsx L104 |
| Pet selector chips (single + multi) | ✅ L72 |
| MultiPetSummary strip with priority chips | ✅ MultiPetSummary.tsx |
| "Compare pets side-by-side" dashed pill → `/health/compare` | ✅ L95 + HealthCompare.tsx |
| Pet header: name, breed, public_id, allergy/condition tone chips, microchip | ✅ L111-152 |
| Get verified pill ↔ Verified badge | ✅ L116-127 + VaxVerifyDialog |
| PetID QR + Share + Export PDF triplet | ✅ L153-157 |
| Timeline + Book a vet quick row | ✅ L161 |
| Big "Ask the AI assistant" CTA | ✅ L172 |
| Quick weight + Log symptom row (severity slider, AI classify, dialog auto-open via signal) | ✅ L180, L437-582 |
| DailyCare / CareTeam / VetVisitNotes / HeatCycle (intact-female only) / Insurance / HealthInsights / MedicalDisclaimer | ✅ L189-203 |
| 7 tabs (Vitals, Vax, Meds, Parasite, Symptoms, Food, Records) with edge fades | ✅ L208-239 |
| Vax: Scan card + Add manually | ✅ L264 |
| Meds: PharmacySuggestionsCard + MedicationsTab | ✅ L231 |
| Symptoms tab: red emergency card with Call vet / Ask vet now | ✅ L464 |
| Vet share: 1h/24h/7d expiry pills, scope toggles, QR + 8-char code, recent views (30s polling) | ✅ L703-887 |
| Global EmergencyBanner mounted in AppShell, 24h window, real-time | ✅ EmergencyBanner.tsx |
| `/health/alerts` inbox with per-pet filter, severity tones, swipe-dismiss | ✅ HealthAlerts.tsx |
| Header bell + alert pill on `/health` | ✅ L60 + AppShell |
| Units: kg/°C canonical storage, lb/°F display via `useUnits` | ✅ WeightChart, QuickWeightSheet, VitalsTab all unit-aware |
| PDF passport with QR cover | ✅ health-export-pdf |
| Past consults list at bottom | ✅ ConsultsList |

### Gaps found (the only real work)

| # | Gap | Where | Fix |
|---|---|---|---|
| 1 | PetEditor "Target weight" field is hard-labelled `(kg)` regardless of the user's unit preference | `src/pages/settings/PetEditor.tsx` L106 | Use `useUnits()` for label + parse via `parseWeightToKg` on save |
| 2 | Empty state on `/health` (no pet) has no CTA — user must guess to go to Settings | `src/pages/Health.tsx` L104-108 | Add a primary "Add your first pet →" button linking to `/settings/pets/new` |
| 3 | Severity slider only shows 5 dots — non-medical users have no idea what "3" vs "5" means | `Health.tsx` SymptomDialog L560-566; same dot scale in symptom cards | Add a one-line helper under slider that updates with the value: 1 "Mild — keep an eye on it" · 2 "Noticeable — log it" · 3 "Concerning — book a vet this week" · 4 "Serious — call vet today" · 5 "Emergency — go now" |
| 4 | New users land on tabs with zero context about what each one is for | Each of 7 `EmptyState` calls already has a `hint`, but Vitals/Meds/Parasite/Food empty hints are short or missing nuance | Audit all 7 empty hints to a consistent plain-English template: "Track X. Why it matters: Y. First step: Z." (one-line copy edits) |
| 5 | Vet-share "Recent views" panel ignores the `section` field even though it's selected from DB | `Health.tsx` L862-873 | Render the section name when present (e.g. "Vault opened · Vaccinations") |
| 6 | Quick weight save gives a generic toast — no traffic-light feedback vs target_weight_kg (the journey explicitly promises this) | `src/components/health/QuickWeightSheet.tsx` | After insert, fetch `pets.target_weight_kg`, compute delta in user's unit, show coloured toast: green ≤ ±2%, amber ≤ ±10%, red beyond |
| 7 | "Compare pets side-by-side" pill is the only multi-pet shortcut — the new alerts pill doesn't show pet name when only one alert references one pet (minor polish) | `Health.tsx` L60-69 | If all unread alerts belong to one pet, append " · <PetName>" to the pill label |

### Implementation order (one pass, no overlap)

**Step A — Settings polish (2 file edit)**
- `src/pages/settings/PetEditor.tsx`: import `useUnits`, change Target-weight label/placeholder to user unit, convert input → kg via `parseWeightToKg` on save, display existing value via `kgToDisplay`.

**Step B — `/health` empty state CTA (1 file edit)**
- `src/pages/Health.tsx` L104: replace static empty card with a card that includes a `<Button onClick={() => nav("/settings/pets/new")}>Add your first pet</Button>`. (Confirm route exists; otherwise route to `/settings`.)

**Step C — Severity guide (1 file edit)**
- `src/pages/Health.tsx` SymptomDialog: add a small helper line under the `<Slider>` that reads the current `form.severity` and prints the matching label+colour. Reuse `SeverityDots` for visuals.

**Step D — Empty-state copy audit (1 file edit + tab components)**
- Tighten the `hint` prop on each `EmptyState` in Vitals/Vax/Meds/Parasite/Symptoms/Food/Records to the "Track / Why / First step" template. Pure string changes.

**Step E — Vet-share section label (1 file edit)**
- `src/pages/Health.tsx` L862: when `v.section` exists render `Vault opened · {v.section}`.

**Step F — Quick-weight delta toast (1 file edit)**
- `src/components/health/QuickWeightSheet.tsx`: after insert succeeds, run `supabase.from("pets").select("target_weight_kg").eq("id", petId).single()`, compute % delta vs entered kg, dispatch `toast.success/warning/error` with copy like "Saved · 1.2 kg over target".

**Step G — Smarter alert pill (1 file edit)**
- `src/pages/Health.tsx` L60: if `alertUnread.every(a => a.pet_id === alertUnread[0].pet_id)` and that pet exists in `pets`, append its name.

### Out of scope (already covered or explicitly not requested)
- Onboarding wizard rewrite, push-notification plumbing, new edge functions, AI prompt tuning, schema migrations.

### Estimated touch surface
~6 files, ~150 lines total. Zero new components, zero migrations, zero new edge functions. Stays well within a single small implementation cycle.
