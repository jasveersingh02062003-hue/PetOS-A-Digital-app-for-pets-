
# Deep Health System Audit — Reality Check

This is an analysis only. **No code will be changed.** Below is exactly what exists, how it works, where the user goes, and what is genuinely missing vs. marketing copy.

---

## 1. What we are tracking (every data point, real)

The Health vault is split into **7 tabs + 4 cards above the tabs**. Each is backed by its own Postgres table. Live row counts in production right now: **all zero** (no real users have logged anything yet).

### 1A. Tabs

| Tab | Table | Fields actually captured | Notes |
|---|---|---|---|
| **Vitals** | `vital_logs` | weight_kg, temperature_c, heart_rate_bpm, respiratory_rate_rpm, body_condition (1–9), gum_colour (free text), hydration (free text), notes, recorded_at | All numeric fields are optional. Weight feeds the trend chart. |
| **Vaccinations** | `vaccinations` | vaccine_name, administered_on, next_due_on, vet_name, batch_number, notes | Two add paths: manual form + AI photo scan of card. |
| **Medications** | `medication_logs` | name, dose, route, frequency (free text), reason, prescribing_vet, start_on, end_on, active toggle | "Frequency" is free text — there is **no schedule, no dose-tick reminder**. Just a record. |
| **Parasite** | `parasite_preventatives` | product_name, parasite_type (flea/tick/heartworm/dewormer/combination/other), given_on, next_due_on, batch_number, notes | "Overdue" badge if next_due_on < today. |
| **Symptoms** | `symptom_logs` | symptom (free text), severity 1–5 slider, notes, ai_flag, ai_reason | After save → AI classifies. |
| **Nutrition** | `nutrition_logs` | food (free text), portion (free text), fed_at, notes | No calorie maths, no portion library, no goal tracking. |
| **Records** | `health_records` | title, record_type (visit/diagnostic/prescription/surgery/allergy/other), occurred_on, notes | No file/PDF upload field — text only. |

### 1B. Cards above the tabs (always visible)

- **Pet header card** — name, breed/species, public_id (Pet ID), `vaccination_verified` badge.
- **Pet ID button** — opens dialog with QR + 8-char public_id linking to `/v/<id>` (vet vault view).
- **Vet Share button** — generates a 24-hour code via `vet-grant-create` edge fn → row in `vet_access_grants`.
- **Export PDF button** — calls `health-export-pdf` edge fn, returns a generated PDF passport. Plus tier removes watermark.
- **Timeline button** → `/health/<petId>/timeline` (merges 8 source tables in one chronological feed).
- **Book a vet button** → `/book-vet?pet=<id>`.
- **Ask the AI assistant button** → `/ai` (free chat, separate from emergency triage).
- **Insurance card** — fetches `insurance_partners` (2 partners seeded), opens partner URL in new tab and writes a row to `insurance_leads`.
- **AI Health Insights card** — pulls `health_insights` row, "Generate" button calls `ai-health-insights`.
- **Care Team card** *(only inside the pet profile, not on /health)* — list/revoke vets in `pet_care_team`. Add by searching `vet_profiles`.
- **Pharmacy Suggestions card** *(meds tab only)* — lists vet-pushed `pharmacy_suggestions` with "Find in shop" CTA.
- **Recent vet consults list** — last 5 `vet_consults` rows.
- **Medical disclaimer** — small inline legal text.

### 1C. What is NOT tracked anywhere (despite being "pet super-app")

- **Photos** of symptoms, wounds, skin conditions on a symptom log. (PhotoVet exists but doesn't attach to symptom_logs.)
- **File attachments** on health records (lab PDFs, X-rays, ultrasounds).
- **Heat/oestrus cycles** for unspayed females.
- **Weight goals / target weight** — only raw history.
- **Activity / steps / sleep** — no wearable integration, despite the home strip showing "active today".
- **Allergies as a structured field** — only as a `record_type='allergy'` text record.
- **Chronic conditions** — no separate flag or list.
- **Microchip number** — not stored on pets table or here.
- **Insurance policy number / claim history** — only "leads" (we hand off to partner, then nothing).
- **Vet notes from in-person visits** — Care Team allows access but has no UI for vet to write a structured note back.
- **Dental health / grooming logs.**

---

## 2. The logic (what fires when)

### 2A. On symptom save (`SymptomDialog.submit`)
1. Insert row into `symptom_logs` with `severity` 1–5.
2. Immediately invoke edge fn `ai-symptom-classify` with the new log_id.
3. Edge fn:
   - Verifies the user owns the parent pet.
   - Calls Lovable AI Gateway, model `google/gemini-2.5-flash`, with a 3-bucket system prompt (`watch | vet_soon | emergency`).
   - Writes `ai_flag` + `ai_reason` back to the row.
   - If `emergency` → calls `notify_user` RPC → notification + push to owner.
4. Client toast varies by flag (red on emergency, amber on vet_soon).
5. Symptoms tab shows a destructive banner if any emergency-flagged symptom exists in last 48h, with **Call vet** (currently `tel:` with no number wired) + Ask vet now.

### 2B. On vital save
- Just insert. No analysis.
- Weight chart re-renders if there are ≥2 weight points.

### 2C. On vaccination save (manual or scan)
- Insert. No client logic.
- A **daily cron** (`vaccination-reminders`) runs server-side: for any vaccine with `next_due_on` between today+4 and today+6, push a notification, dedupe via `reminder_log` keyed `vaccine_5d`.

### 2D. On parasite/med save
- Insert. Daily cron `pet-care-reminders` notifies 3 days before `next_due_on` for parasites and similar for meds.

### 2E. AI Photo scan (vaccination card)
- Image downscaled client-side to ≤1600 px JPEG.
- Sent as base64 to `ai-parse-vaccinations` edge fn → returns array of drafts.
- User reviews/edits each draft → bulk insert into `vaccinations`.

### 2F. AI Health Insights (manual generate)
- Button on the card calls `ai-health-insights` with `pet_id`.
- Edge fn pulls pet + recent vitals/symptoms/nutrition, calls AI, writes `health_insights` row keyed by content hash (so refresh is idempotent unless `force=true`).

### 2G. Proactive AI scan (background)
- `ai-proactive-scan` cron, every 6h.
- Per pet, looks at last 7 days of `nutrition_logs` and high-severity `symptom_logs`. **Rule-based, not AI** for the trigger; just rules:
  - "ate more than usual": last-24h meal count ≥ avg-prior-day + 2.
  - "hasn't eaten today": prior-day avg ≥1, last 24h = 0.
  - "symptom_high": any severity ≥4 in last 7d.
- Writes `proactive_alerts` row + push via `notify_user`. Dedupe per-day via `dedupe_key`.

### 2H. Health status strip (home page)
- Reads view `pet_health_status`.
- Computes a 0–100 health score on the **client**:
  - −20 if not `vaccination_verified`.
  - −15 if parasite overdue.
  - −10 if no activity log in last 3 days.
- "Activity" here refers to `last_activity_on` from the view — there's no real activity feed, so this column is almost certainly always null in practice.

### 2I. Vault access (vet-facing)
- Owner generates 24h grant → 8-char code + QR → `/v/<code>` route reads via `vault-view` edge fn (not inspected here).
- Permanent Pet ID (`public_id`) → `/v/<public_id>` for the regular vet on the care team.

---

## 3. The AI surface (every place AI is used)

| Surface | Edge fn | Model | What it does |
|---|---|---|---|
| Free chat from Health/Home | `chat` (mode=chat) | `google/gemini-3-flash-preview` | Streaming chat, grounded by pet vault. Free tier capped at 3/30d. |
| Emergency triage (DogtorAI) | `chat` (mode=triage) | same | After exchange, returns structured `{severity, summary, recommend_vet, home_care}`. |
| Symptom auto-classify | `ai-symptom-classify` | `gemini-2.5-flash` | watch/vet_soon/emergency on every symptom save. |
| Vaccination card OCR | `ai-parse-vaccinations` | (vision model via gateway) | Extracts vaccine list from a photo. |
| Health insights | `ai-health-insights` | gateway | On-demand summary card with 0–N actionable insights. |
| Photo-vet | `ai-photo-analyze` | gateway | Skin / breed / mood scan from a photo. **Not connected to symptom_logs**. |
| Proactive alerts | `ai-proactive-scan` | **NO AI** — pure rules | Misnamed; it's a cron with hand-written thresholds. |

**Reality:** the only *clinical* AI decision is symptom classify + triage. Everything else is summarisation or extraction.

---

## 4. Emergency / SOS journey (end-to-end, exactly as wired)

1. User taps the red **EmergencyButton** on Home (`/vet-triage`).
2. `VetTriage.tsx` opens with a Siren header and pet selector.
3. First message → lazily creates `vet_triage_sessions` row.
4. Streams reply from `chat` edge fn (mode=chat).
5. After assistant finishes → calls `chat` again (mode=triage) for structured verdict.
6. Verdict card shows tone (mild/moderate/severe), summary, home_care list.
7. If `recommend_vet` → "Talk to a vet now" button → navigates to `/book-vet?pet=<id>&triage=<sid>`.
8. If moderate/severe → also shows `<NearestVetCta />` (geo-based clinic finder).

**Settings → Emergency vet** lets the owner save name/phone/clinic into `profiles.emergency_vet`. **But:**
- The Symptoms tab "Call vet" button uses `<a href="tel:">` with **no phone interpolated**. Dead button.
- The triage screen never reads the saved emergency vet either.
- There is no "call this clinic now" surface anywhere using the saved number.

This is a real gap: we collect the emergency vet number, then never use it.

---

## 5. User journey (the Health side)

```text
Onboard → Add pet → /health (Vault)
  ├── Header (Pet ID / Share / Export)
  ├── Quick actions (Timeline / Book vet / Ask AI)
  ├── Insurance card (lead handoff)
  ├── AI Insights card (manual generate)
  ├── Tabs (Vitals, Vax, Meds, Parasite, Symptoms, Nutrition, Records)
  └── Recent vet consults

Pet profile (/pet/:id) → Care Team card (manage vets)

Home strip → HealthStatusStrip → click → /health
Home red SOS → /vet-triage → optional /book-vet
Symptoms tab emergency banner → /askvet/new (not triage, not call)
```

User journeys that **break or dead-end**:
- "Call vet" on emergency symptom banner → empty `tel:` link.
- AI health insight CTA links → may or may not match a real route depending on `cta_link` returned by AI; no validation.
- "Find in shop" from pharmacy suggestions → search query may return no products if the catalogue doesn't carry the medicine name.
- Insurance "Quote" → opens partner URL → user never returns; no follow-up tracking beyond the lead row. Plan/policy is never re-attached.
- Pet ID QR → relies on `/v/<public_id>` route + `vault-view` edge fn behaving for unauthenticated vets; not audited here.

---

## 6. UI / UX (what it actually looks and feels like)

### Strong points
- Apple-style restrained palette, hairline borders, rounded-2xl, Display font for headings — consistent.
- Tab strip is horizontally scrollable with iconography, fits a 393px viewport.
- All add flows are modal Dialogs with the same FormField, same SkeletonList, same EmptyState — predictable.
- Severity dots and the colour-coded triage card (leaf/amber/emergency) are clear at a glance.
- Symptom emergency banner is appropriately loud (destructive border + Siren icon).

### Weaknesses (real ones)
- **Tabs overflow on first paint.** 7 tabs at 12-px font on a 393-px screen require a scroll the user may not notice. No swipe affordance.
- **No empty-state coaching.** Each tab just says "No X recorded" with no example or "what to log first" tip. New users see seven empty boxes.
- **No "today's care" summary.** There is no "what does my pet need this week" view. The vault is reference-only; daily care isn't surfaced.
- **AI Health Insights is opt-in.** Card sits empty until user taps Generate. Most users will never tap it.
- **Insights CTA buttons are coloured by severity but everything is clickable** — even info-only insights, which `nav("")` may navigate awkwardly.
- **Vitals form is a dump of inputs.** No quick "Just weight" path; user must open a 7-field dialog to log a single weight number. Mobile-hostile.
- **Symptoms severity slider is 1–5 but visualised with 5 dots that re-colour at level ≥4.** No labels (mild/moderate/severe) on the slider itself.
- **Frequency on meds is free text.** "Twice daily" / "BID" / "Every 8h" all coexist; downstream reminders cannot parse it.
- **Records have no file upload.** Notes-only is a real limitation for a "vault".
- **Care Team is hidden** inside Pet Profile, not on /health where vets and meds are. Discovery is poor.
- **No multi-pet aggregate view.** Switching pets is a horizontal pill scroll; no "all pets at a glance" home for multi-pet households.
- **Home health strip is silent if `pet_health_status` view returns null** — for a brand-new user it just doesn't render, so they don't know it exists.
- **Disclaimer placement** is good (above tabs and inside triage), but the AI insight card itself doesn't carry one.

---

## 7. Gaps vs. a real-life pet health app (the honest list)

Categorised by impact. "Have" / "Half" / "Missing".

### A. Daily care loop — **mostly Missing**
- Have: ad-hoc logging.
- Missing: a daily/weekly "care card" surfacing what's due (next vaccine in N days, next dose today, parasite due Friday, last weight 12d ago), proactive nudges in the UI not just as push notifications.

### B. Medication adherence — **Half**
- Have: list of meds with active toggle.
- Missing: dose schedule, "mark dose taken" tick, missed-dose history, refill reminder when end_on near.

### C. Photo evidence on records — **Missing**
- PhotoVet and ScanVaccinations exist in isolation; neither attaches an image to the symptom_log or health_record it relates to. Vets can't see the picture you showed the AI.

### D. Heat / reproductive cycle — **Missing entirely**
- For unspayed pets and breeders this is fundamental. We track `neutered` boolean only.

### E. Activity / weight goals — **Missing**
- WalkLive page exists but its data isn't surfaced into the health strip "active today" claim. Score subtracts 10 points for a metric it cannot measure.

### F. Emergency wiring — **Half**
- Triage AI works.
- The phone number we collect is never dialled from any UI (dead `tel:` button).
- "Nearest vet" exists on triage but not on the symptom emergency banner.

### G. Vet-side experience — **Half**
- Vet can be added to care team and view via Pet ID.
- Vet has no structured "write a visit note" UI that lands back on the timeline as a verified entry. `vet_consults` exists but only for AI-mediated consults, not in-person visits.
- `pharmacy_suggestions` exists for vets to push prescriptions, but there's no UI surface in the app for a vet to *create* one (only the customer-facing list).

### H. Insurance — **Lead only**
- We hand off to a partner. Nothing comes back. No claim filing, no policy storage, no "your coverage" view.

### I. Multi-pet and family sharing — **Half**
- Pet switcher works.
- Care team grants vets access; there's no equivalent for "co-owner / spouse / dog walker" with read-only or limited write scopes from inside the Health screen. Family/care-team for non-vets exists in other tables but is not surfaced here.

### J. Data portability — **Have**
- `data-export` and `health-export-pdf` exist. PDF is gated behind Plus for clean print; preview is free.

### K. Trust signals — **Half**
- `vaccination_verified` badge exists but is not currently set anywhere in the user-facing flow (no UI turns it on; presumably admin/vet only). For a new owner it will read as "unverified" forever.

### L. Records files — **Missing**
- No upload field on `health_records`. Lab PDFs and X-rays cannot be stored.

### M. Allergies / chronic conditions as first-class — **Missing**
- Only as a free-text record_type. No badge on pet header, no AI-prompt context.

### N. Disclaimer / safety — **Have**
- Inline + dialog disclaimers in chat and triage. AI insight card lacks one (minor).

### O. Internationalisation / units — **Missing**
- Hardcoded kg, °C, INR for insurance. No imperial/USD toggle.

---

## 8. The honest one-line summary

> **The vault is solid as a record-keeping app. The AI bits work but only fire when the user actively logs something. The "emergency" loop captures the user's vet number but never dials it. Daily care, dose schedules, file attachments, vet visit notes-back, heat cycles, and activity integration are all missing.**

---

## 9. What this audit recommends (reality, ordered by user impact)

1. **Wire the Emergency vet number** into the symptom emergency banner and the triage screen. Highest impact, lowest effort.
2. **Daily care card on /health** — "Due today / this week" surfacing vaccines, parasite, doses, weight check. Turns the vault from passive to active.
3. **Med dose schedule + tick-off** — convert `medication_logs.frequency` into a structured schedule and add a "mark dose given" entry table.
4. **Photo attachments on symptom and record entries** — re-use existing storage; lets vets actually see what owners describe.
5. **Vet visit-note write-back UI** — let care-team vets append a structured note that lands on the timeline as a verified entry.
6. **Heat cycle tracking** — new mini-tab for unspayed females; breeders need this.
7. **One-tap "log just weight"** quick action on Vitals.
8. **Empty-state coaching** on every tab + a "what to log first" onboarding hint.
9. **Validate `vaccination_verified` flow** — give an actual path for the badge to be earned, otherwise remove it.
10. **Drop or fix the "active today" component** of the health score — it always penalises users until WalkLive feeds it.

This is the deep, honest reality. **No code has been changed; everything above is an audit only.** Let me know which slice you want to fix first and I'll plan that sprint.
