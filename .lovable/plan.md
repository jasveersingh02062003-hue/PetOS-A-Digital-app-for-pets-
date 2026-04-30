# Reality check + one consolidated plan

I read the actual code behind every claim in the user journey. Below is the honest score, then **one plan** covering the five new asks at the bottom — no overlap.

---

## Part 1 — Reality check (claim by claim)

### Verified working as described

- Health vault headline + empty state.
- Pet selector chips, active pet highlighted in primary.
- Header card: name + breed/species + PET-XXXXX, allergy chips (amber), condition chips (rose), microchip line.
- "Get verified" pill → `VaxVerifyDialog` → request row → vet review at `/vet/verifications` → trigger flips `vaccination_verified`.
- Three header buttons: Pet ID (QR + microchip in dialog), Vet share (24h grant via `vet-grant-create`), Export PDF.
- Quick actions grid: Timeline, Book a vet.
- Big "Ask the AI assistant" CTA → `/ai`.
- Quick weight sheet (uses `useUnits`, stores kg).
- Daily care card (vax/parasite/dose/weight reminders).
- Care team card, Vet visit notes card, Heat cycle (only female + intact), Insurance card with 3 states + claim, Health Insights card with 12h cache.
- Seven-tab strip with scroll-snap + edge-fade gradients.
- All seven tab contents (Vitals chart + target line, Vax with Scan card, Meds with Vet prescriptions + Mark filled, Parasite, Symptoms with AI flag + photo, Food, Records).
- Multi-pet summary strip when ≥2 pets — colored urgency chip per pet, tap switches active.
- Units: settings → display swap across WeightChart, QuickWeight, VitalsTab.
- Vet loop: prescription appears on Meds tab, mark filled bounces back to vet.
- Insurance round-trip via webhook → policy fields written, claim flow.
- Symptoms: AI classifies, emergency banner appears with **Call vet** / **Ask vet now** if `emergency_vet.phone` set, AI reason shown.

### Gaps where the journey overstates reality

1. **"Log symptom" quick button just opens the timeline page**, it does not jump straight into the symptom dialog.
2. **PDF passport is broken in two ways**:
   - It queries a `weights` table that doesn't exist (real table: `vital_logs`) — weight chart is always empty.
   - It does not include allergies, conditions, microchip, or target weight in the printed passport.
3. **Emergency mode is a half-feature**:
   - The `EmergencySheet` exists and `ai-symptom-classify` flags emergencies + sends notifications, but **there is no global red banner on the home/health screen** when an emergency is live — it only appears inside the Symptoms tab.
   - SOS dialer is only inside the symptom tab banner; not promoted from the header during emergencies.
4. **Multi-pet compare** — the strip shows status per pet, but there is no side-by-side view (weight curves, vax status, insurance state) to actually compare two pets.
5. **Vet share link UX is bare** — generates a 24h code; missing: customisable expiry (1h/24h/7d), scope toggle (vitals only vs full vault), per-grant audit log of what the vet viewed, and a quick-revoke button on the Care Team card.
6. **Health Alerts** as a category does not exist in-app. There are reminders (push) and the daily-care card, but no unified "alerts inbox" the user can scan.

Everything else in the journey is faithful to the code.

---

## Part 2 — One consolidated plan (5 asks, zero overlap)

```text
Slice 1  Health Alerts inbox             — new component + route
Slice 2  Emergency Mode (global)         — banner, header SOS, sheet polish
Slice 3  Multi-Pet Compare               — new tab in /health header strip
Slice 4  PDF Health Passport (fix+grow)  — edge function + button options
Slice 5  Vet Access Links polish         — expiry/scope/audit on grants
```

### Slice 1 — Health Alerts inbox

**Why**: today's alerts are scattered across push, daily-care, symptom banner, vax-due. Owners want one place to see "what needs my attention".

**What we build**
- New table `health_alerts` (alert_id, owner_id, pet_id, kind, severity, title, body, link, dedupe_key, created_at, read_at, dismissed_at). Severity = `info | watch | action | emergency`.
- DB function `enqueue_alert(...)` used by:
  - existing `vaccination-reminders` cron
  - `pet-care-reminders` cron
  - `ai-symptom-classify` (emergency / vet_soon)
  - `ai-proactive-scan`
  - insurance webhook (policy bound, claim updated)
  - vaccination verification approved/rejected
- New `/alerts` page: chronological list, filter by pet, swipe-to-dismiss, tap-to-link.
- Bell icon with unread count in the AppShell header (only on `/`, `/health`, `/alerts`).
- Real-time subscription on `health_alerts` so badge updates live.
- A compact "3 new alerts" pill shown on top of `/health` when the inbox is non-empty.

### Slice 2 — Emergency Mode

**Why**: the panic moment must be unmistakable, regardless of where in the app you are.

**What we build**
- New hook `useActiveEmergency(petIds)` — single subscription that returns the most recent unresolved `emergency`-flagged symptom in last 24h for any of the user's pets.
- **Global red banner** rendered in `AppShell` (above everything except modals) when an emergency is active: pet name, AI reason, two buttons:
  - **Call [vet name]** (`tel:`) — uses `profile.emergency_vet.phone`
  - **Ask vet now** → `/askvet/new`
  - Tertiary: **Mark resolved** writes `resolved_at` on the symptom log (new column).
- **Persistent SOS button** in the `/health` header (replaces nothing; small siren-icon button) that opens the existing `EmergencySheet`.
- `EmergencySheet` polish:
  - Pet picker shows allergies/conditions inline.
  - After triage = severe: auto-include the last 3 symptom logs + current meds in the "Ask vet now" payload.
  - One-tap "Share live location" that creates a 30-min vet share grant (reuses Slice 5 scoping).
- Symptoms tab banner kept; the global banner is additive.
- Emergencies also auto-write a `health_alerts` row (Slice 1) so it shows up in the inbox forever.

### Slice 3 — Multi-Pet Compare

**Why**: owners with multiple pets currently flip back and forth. They want to compare at a glance.

**What we build**
- New route `/health/compare` (button on the multi-pet strip: "Compare").
- Page renders a 2-column (or N-column on tablet) layout with one column per selected pet:
  - **Header**: avatar, name, age, weight (in user units), target delta.
  - **Vitals row**: latest weight, temp, last weighed date.
  - **Vax**: last shot, next due, verified state.
  - **Parasite**: next due.
  - **Active meds**: count + names.
  - **Insurance**: state.
  - **Open symptoms**: count of last-7-day logs.
- A small **mini weight chart** per pet on the same y-axis bands so curves are visually comparable.
- Pet picker chips at the top — choose 2 to 4 pets to compare.
- "Export comparison PDF" reusing Slice 4 generator with `pet_ids[]`.

### Slice 4 — PDF Health Passport (fix + grow)

**Bug fixes** (must do regardless)
- Read `vital_logs` not `weights`; use `recorded_at` and `weight_kg`.
- Pull `allergies`, `conditions`, `microchip_id`, `target_weight_kg` and render them.
- Use `useUnits`-equivalent server logic: include kg + lb in the passport so any vet can read it (small parenthesised conversion).

**Growth**
- New cover page: pet photo (avatar_url), QR pointing at `/v/{public_id}`, microchip number, owner name + emergency contact phone.
- Sections in order: Identity, Conditions & Allergies, Vaccinations (with verification badge), Active Meds + Recent Prescriptions, Parasite Schedule, Vitals (chart + last 5), Recent Symptoms (last 30d), Records list with hyperlinks.
- Footer: "Generated DD MMM YYYY · valid as of date · share code XXXXX" — share code created automatically (24h expiry) so vet can verify online.
- Button options dialog: range (3m/12m/all), include owner contact yes/no, include photos yes/no.
- Multi-pet variant: `pet_ids[]` produces one section per pet for boarding/travel.

### Slice 5 — Vet Access Links polish

**Why**: today's grant is one-size 24h. Vets often want a short window with limited scope; owners want to see what was viewed.

**What we build**
- Migration on `vet_access_grants`:
  - `expires_in_minutes` (60 / 1440 / 10080 presets, default 1440)
  - `scope` text array (`vitals`, `vax`, `meds`, `records`, `symptoms`, `insurance`) — empty = full
  - new table `vet_access_views` (grant_id, viewed_at, section, ip_hash) populated by `vault-view`.
- `VetShareBody` UI:
  - Expiry select (1h / 24h / 7d) before generating.
  - Scope checkbox grid (default: all on).
  - After creation: shows what the vet has accessed ("Viewed Vitals 12 min ago").
  - Single-tap **Revoke** button always visible.
- `vault-view` edge function:
  - Honour `scope`: filter response sections accordingly.
  - Insert a `vet_access_views` row per request.
- Care Team card gets a "Recent share links" footer with active grants and revoke buttons (no need to open the dialog).

### Wrap-up — small fix included for free
- The "Log symptom" button on `/health` will route directly to the Symptom dialog (`?openSymptom=1`) instead of dropping the user on the timeline.

---

## What this plan deliberately does NOT touch
- Activity / wearable tracking — still excluded by your earlier instruction.
- Vet billing or earnings flows.
- New tab in the seven-tab strip — alerts live in their own page, not as a tab.
- Notification settings UI — alerts inbox respects existing notification prefs unchanged.

## Order, credits posture
A → 1 → 2 → 3 → 4 → 5. Each slice is independently shippable. Total: **3 small migrations, ~8 new components, ~6 edits to existing files, 1 edge-function bug fix, 2 edge-function feature adds.**
