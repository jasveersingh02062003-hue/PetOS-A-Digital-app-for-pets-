## Goal

Two upgrades that move PetOS toward a real production app:

1. **Health tracking** — capture every clinically meaningful signal for a pet, time-stamped, exportable, with a unified timeline so an owner (or vet) can see the full history at a glance.
2. **Vet portal in the same app at `/vet/*`** — doctor onboarding, patient lookup by short code OR permanent Pet ID, appointment scheduling (chat / video / in-clinic), patient list with full health timeline, vet schedule view. Free during beta.

---

## Part 1 — Health tracking research & data model

What a vet actually needs to make decisions, mapped to what we'll capture:

**Identity & baseline** (already in `pets`)
- Name, species, breed, DOB, sex, neuter status, microchip ID *(new)*, insurance policy + provider *(new)*, primary vet *(new)*, allergies, chronic conditions, current medications *(new column)*, blood type *(new, optional)*

**Vitals** (new table `vital_logs`) — timestamped, charted
- Weight (kg), body condition score 1–9, temperature (°C), heart rate (bpm), respiratory rate (rpm), gum colour, hydration (skin tent)

**Vaccinations** (already exists) — add: route (SC/IM), site, reaction notes, certificate file

**Parasite prevention** (new table `parasite_preventatives`)
- Product, type (flea/tick/heartworm/dewormer), date given, next due, batch

**Medications** (new table `medication_logs`)
- Name, dose, route, frequency, start date, end date, prescribing vet, adherence ticks per dose

**Diet & nutrition** (extend existing `nutrition_logs`)
- Food brand, kcal/day, treats, water intake (ml), appetite 1–5

**Activity & behaviour** (new table `activity_logs`)
- Walk minutes, energy 1–5, sleep hours, mood tags, stool score 1–7, urine frequency

**Symptoms** (already exists) — add: photo, duration, body location

**Visits & diagnostics** (already in `health_records`) — add: vet name, clinic, diagnosis ICD-style code, attached files

**Reproductive** (cats/dogs) (new table `repro_logs`)
- Heat cycle dates, mating dates, pregnancy confirmation, litter records

**Lifecycle alerts** — auto-generated reminders for: vaccinations due, parasite prevention due, medication refills, weight trend warnings (>10 % loss in 30 days), missed vital checks for senior pets.

**Timeline view** — single chronological feed across ALL of the above, filterable by type, date range, severity. Export as PDF for the vet.

---

## Part 2 — Vet portal at `/vet/*`

### Vet onboarding (after they apply & are approved)
A 5-step wizard the first time they log in to `/vet`:
1. Profile — full name, photo, languages
2. Credentials — license number, issuing council, year qualified, license document upload
3. Practice — clinic name, address, city, GPS, phone
4. Specialisations (multi-select): general, surgery, dermatology, cardiology, oncology, dentistry, exotics, behaviour, nutrition, emergency
5. Availability & consult modes — weekly recurring slots, which modes they offer (chat, video, in-clinic), price (₹0 during beta), consult duration (15/30/45 min)

### Patient access — two paths
- **One-off code**: owner taps "Share with vet" on a pet → 6-digit code valid 24h (extends existing `vet_access_grants`). Vet enters in dashboard → read-only access to that pet's full timeline for the grant period.
- **Permanent Pet ID**: every pet gets a permanent code like `PET-A8F2Q` (new column `pets.public_id`). Vet enters it → owner gets a push/notification "Dr. X requests access to Buddy" → owner approves once → vet stays on Buddy's care team until revoked. Stored in new table `pet_care_team(pet_id, vet_id, granted_at, revoked_at)`.

### Vet dashboard tabs
1. **Today** — today's appointments, urgent consults, unread chats
2. **Schedule** — week calendar, drag to mark availability, see booked slots, reschedule
3. **Appointments** — list with filters (chat / video / in-clinic), upcoming / past
4. **Patients** — every pet on their care team + recent code-grants, search by Pet ID or owner phone, click → full health timeline read-only, can append visit notes / prescription
5. **Consults** — existing tele-vet queue (already built)
6. **Verifications** — existing pet vaccination verification queue (already built)
7. **Profile / Earnings** (Earnings hidden during beta)

### Owner-side appointment booking
On the existing `Vet` page (when not a vet), add:
- Search vets by city + specialisation
- View vet profile, ratings, available slots
- Pick date + time + mode (chat / video / in-clinic) + which pet → creates an `appointments` row
- Day of: chat opens automatically; video opens in-app (Daily.co room); in-clinic shows clinic address + directions

### Video infrastructure
Use **Daily.co** (free tier 10k participant-minutes/mo). Edge function `create-video-room` mints a room + short-lived tokens for vet & owner. Single secret: `DAILY_API_KEY`. We'll request it before deploying that function.

### New tables (migrations)
- `vet_profiles` — extends user_roles vet with onboarding fields (license, clinic, specialisations[], availability jsonb, consult_modes[], duration_min, price_inr)
- `vet_availability_overrides` — date-specific blocks/holidays
- `appointments` — vet_id, owner_id, pet_id, mode, status, scheduled_at, duration_min, video_room, notes, prescription
- `appointment_messages` — chat thread per appointment
- `pet_care_team` — persistent vet↔pet links
- `vital_logs`, `parasite_preventatives`, `medication_logs`, `activity_logs`, `repro_logs` — health tables above
- Add columns: `pets.public_id`, `pets.microchip_id`, `pets.insurance_provider`, `pets.insurance_policy`, `pets.current_medications`, `pets.primary_vet_id`

All with strict RLS: owner full access to their pet rows; vets see only pets where they have an active grant or care-team link or appointment.

---

## Part 3 — File-level changes

**New pages**
- `src/pages/vet/Onboarding.tsx`
- `src/pages/vet/Dashboard.tsx` (tabs: Today, Schedule, Appointments, Patients, Consults, Verifications)
- `src/pages/vet/Schedule.tsx`
- `src/pages/vet/PatientLookup.tsx` (enter code or Pet ID)
- `src/pages/vet/PatientDetail.tsx` (read-only timeline, add visit note, write prescription)
- `src/pages/vet/AppointmentRoom.tsx` (chat + video iframe)
- `src/pages/BookAppointment.tsx` (owner-side flow)
- `src/pages/health/Timeline.tsx` (unified pet timeline + PDF export)

**New components**
- `src/components/health/VitalsCard.tsx`, `MedicationTracker.tsx`, `ParasiteCard.tsx`, `ActivityChart.tsx`, `WeightTrendChart.tsx` (recharts)
- `src/components/health/PetIdCard.tsx` (shows permanent Pet ID + QR)
- `src/components/vet/AvailabilityGrid.tsx`, `AppointmentCard.tsx`, `VideoFrame.tsx`

**Edge functions**
- `create-video-room` — mints Daily.co room
- `request-pet-access` — vet enters Pet ID → notifies owner
- `generate-pet-id` — backfills `public_id` on existing pets
- `export-pet-pdf` — generates printable health summary

**Edits**
- `src/pages/Health.tsx` — add Vitals / Meds / Parasite / Activity tabs, "Pet ID" button, "Timeline" entry
- `src/pages/Vet.tsx` — split: vets routed to new dashboard, owners see vet-search/booking
- `src/App.tsx` — add new routes; vet onboarding gate
- `src/pages/Onboarding.tsx` — capture microchip + insurance optionally

---

## Part 4 — Build order (so you get value fast)

Phase A — Foundations (one shot)
1. DB migrations: all new tables + columns + RLS + `public_id` backfill
2. Pet ID card + Timeline page

Phase B — Health depth
3. Vitals + weight chart, Medication tracker, Parasite prevention, Activity, expanded symptom logging
4. PDF export edge function

Phase C — Vet portal
5. Vet onboarding wizard
6. Vet dashboard (Today + Schedule + Patients + reuse Consults/Verifications)
7. Patient lookup (code + Pet ID approval flow)

Phase D — Appointments
8. Owner booking flow + appointment table
9. Chat thread per appointment
10. Daily.co video integration (will request `DAILY_API_KEY` at this step)
11. In-clinic mode with directions

Phase E — Polish
12. Reminders cron (extend `vaccination-reminders` to cover meds + parasite)
13. Empty states, loading skeletons, vet portal walkthrough coach

---

## Risks & notes

- **Daily.co key** required before Phase D step 10 — we'll prompt then.
- Existing `vet_access_grants` keeps working; new `pet_care_team` is additive.
- During beta, pricing fields default to ₹0 — Stripe wiring stays dormant; we already have it for the future Plus plan.
- Each table gets RLS day-one; no client-trusted role checks.
- Heavy pages (Patients list, Timeline) use cursor pagination from the start.

Reply **yes** to start with **Phase A**. We'll ship phases sequentially and check in between each.
