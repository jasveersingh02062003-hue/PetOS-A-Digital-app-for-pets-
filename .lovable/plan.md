
# Provider Onboarding, Job Board & Role-Based Notification Plan

## 1. What already exists

| Area | Status |
|---|---|
| Account types in `AccountTypeChooser` | Pet parent, Buyer, Breeder, Kennel, Shelter, Sanctuary, Rescuer, Zoo |
| Vet onboarding | Full 3-step flow (`/vet/onboarding`) → `vet_profiles`, admin verifies in `/vet/verifications` |
| Org onboarding | `/onboarding/org` for shelters/breeders/kennels → `org_profiles`, admin reviews in `/admin/org-review` |
| Service listings | `service_providers` table + `/services/new` form covers all 9 categories (grooming, training, walking, sitting, boarding, daycare, caretaker, vet_clinic, pet_taxi) |
| Bookings + payouts | `service_bookings` with status notifications via `notify_user` trigger |
| Notifications | `notifications` table, `notification_jobs` queue, `push_subscriptions`, `send-push` edge function (no-op until VAPID keys) |
| Pet taxi driver tracking | `update_driver_location`, live pin on `/taxi/:id` |

## 2. Gaps (what's missing)

1. **No provider account-type onboarding path.** A user wanting to become a walker / groomer / sitter / caretaker / daycare host / trainer / pet-taxi driver has no guided flow — they have to know to navigate to `/services/new` and fill a generic form. The `AccountTypeChooser` does not list "Service provider" at all.
2. **No KYC / trust documents for individual providers.** `service_providers.verified` exists but no upload path, no admin review queue (unlike vets/orgs).
3. **No category-specific intake.** Walker should capture availability days, max dogs per walk, neighborhoods. Groomer should capture mobile-vs-salon, breed sizes accepted. Daycare: capacity, hours, vaccination policy. Caretaker: live-in vs visiting, languages. Driver: vehicle, license, AC/crate. Trainer: methods, group/private. Boarding: rooms, cat/dog/exotic.
4. **No job board.** Owners cannot post a one-off job ("need a walker tomorrow 6 PM") and have nearby providers get notified to accept. Today everything is owner→provider one-direction (owner picks listing).
5. **No provider dashboard for non-vets.** Vets get `/vet/dashboard`; service providers only get `/services/manage` (CRUD listings) and `EarningsCard`. They have no inbox of new booking requests, no daily schedule, no "new job nearby" feed.
6. **No role-aware notification routing.** Triggers send to one user_id at a time. There is no concept of "broadcast to every active walker within 5 km" (the missing-pet fanout pattern is the only example and is hard-coded for owners).
7. **No availability / on-duty toggle.** A driver/walker/sitter can't say "I'm available now". Discoverability is binary `active` only.
8. **Onboarding wizard only branches 3 ways** (`/onboarding/org`, `/onboarding/buyer-prefs`, `/onboarding/add-pet`). Provider path is missing.
9. **No notification preference per role.** All notifications go to all enabled channels.

## 3. Plan — what to build

### 3.1 Add provider account types + branched onboarding

Extend `AccountTypeChooser` with a new group "I offer pet services":

- Walker
- Groomer (salon / mobile)
- Pet sitter (drop-in)
- Caretaker (in-home)
- Daycare host
- Boarding host
- Trainer
- Pet-taxi driver
- Handyman/other (catch-all)

Each maps to a `service_category` enum value. On select → route to a new `/onboarding/provider/:category` wizard.

### 3.2 Provider onboarding wizard (3 steps, category-aware)

```
Step 1 — Identity & area
  full_name, profile_photo, city, service_radius_km, languages[]

Step 2 — Service details (category-specific block)
  walker:    days[], time_slots[], max_dogs_per_walk, accepts (puppy/senior), price_per_walk
  groomer:   mode (mobile|salon), accepted_sizes[], price_table (XS/S/M/L)
  sitter:    visit_lengths[], price_per_visit
  caretaker: live_in?, min_days, price_per_day
  daycare:   capacity, open_hours, vaccination_strict?
  boarding:  room_count, species_accepted[], price_per_night
  trainer:   methods[], group_or_private, package_prices
  driver:    vehicle, plate, has_crate, ac, capacity, license_no
  handyman:  free-text

Step 3 — Trust & verification
  upload: govt_id, address_proof, certification (optional)
  agree to background check + code of conduct
  → creates service_providers row (verified=false, accepting=false)
  → creates provider_documents rows (private bucket)
  → creates admin review entry
```

### 3.3 New tables / columns

```text
service_providers
  + provider_kind text ('individual' | 'business')   -- already implicit
  + service_radius_km int default 5
  + languages text[] default '{}'
  + days_available text[]                            -- ['mon','tue',...]
  + time_slots text[]                                -- ['morning','evening']
  + accepting_jobs boolean default false             -- on-duty toggle
  + verification_status text default 'pending'       -- pending|approved|rejected
  + verification_notes text
  + details jsonb default '{}'                       -- category-specific bag
  + lat numeric, lng numeric                         -- for radius matching

provider_documents (NEW)
  id, provider_id, kind ('govt_id'|'address'|'cert'|'license'),
  file_path, status, reviewed_by, reviewed_at, notes,
  RLS: owner read/write own, admins read all

job_posts (NEW)                                      -- "I need a walker tomorrow"
  id, owner_id, pet_id, category, title, description,
  scheduled_at, duration_minutes, address, lat, lng,
  budget_inr, status ('open'|'assigned'|'completed'|'cancelled'),
  assigned_provider_id, created_at

job_offers (NEW)                                     -- providers who responded
  id, job_id, provider_id, message, price_inr,
  status ('pending'|'accepted'|'declined'|'withdrawn')
  unique (job_id, provider_id)

notification_preferences (NEW)
  user_id PK, push boolean, email boolean,
  per_kind jsonb default '{}'                        -- {booking_new:true, job_nearby:true, ...}
```

### 3.4 Job board flow (two-sided)

```text
Owner /jobs/new
  pick pet → pick category → date/time → budget → post
        │
        ▼
trigger tg_fanout_job_to_providers
  → INSERT INTO notification_jobs (kind='job_fanout', payload={job_id})
        │
        ▼
process-notification-jobs cron
  → SELECT providers WHERE category=$ AND accepting_jobs AND verified
                     AND distance(lat,lng, job.lat,job.lng) <= service_radius_km
  → notify_user(provider, 'job_nearby', title, body, '/jobs/'||id)
  → optional push via send-push
        │
        ▼
Provider /jobs (inbox)
  sees nearby open jobs → "Send offer" → INSERT job_offers
        │
        ▼
Owner /jobs/:id
  sees offers → accept one → sets job.assigned_provider_id, status='assigned'
  → trigger notify_user(provider,'job_accepted')
  → other offers auto-decline
        │
        ▼
On completion → existing payments flow (kind='service') → receipt + payout
```

### 3.5 Provider dashboard `/provider`

Single screen for any non-vet provider:

- Header: on-duty toggle (writes `accepting_jobs`)
- Today's schedule (from `service_bookings` where date=today)
- Inbox: new booking requests + new job offers awaiting reply
- Nearby jobs feed (radius-filtered)
- Earnings card (existing)
- Listings shortcut (`/services/manage`)
- Verification status banner (pending/approved/rejected)

### 3.6 Admin review queue for individual providers

New tab in `/admin` → "Provider verifications" mirroring `/admin/org-review`:

- List `service_providers` with `verification_status='pending'`
- View uploaded `provider_documents`
- Approve → sets `verified=true`, `verification_status='approved'`, `notify_user('verification_approved')`
- Reject with reason → notify user, allow re-upload

### 3.7 Notification routing improvements

Add `notification_preferences` and respect them inside `notify_user` / `send-push`:

```sql
-- inside notify_user, before insert:
IF NOT user wants this kind THEN RETURN; END IF;
```

New notification kinds and where they fire:

| Kind | Audience | Trigger |
|---|---|---|
| `job_nearby` | providers in radius | `process-notification-jobs` drains `job_fanout` |
| `job_offer_received` | owner | INSERT on `job_offers` |
| `job_accepted` | provider | UPDATE on `job_posts.status='assigned'` |
| `verification_approved` / `_rejected` | provider | admin action |
| `provider_on_duty_reminder` | provider | daily 8 AM cron if `accepting_jobs=false` for 7 days |
| `caretaker_handover_due` | both parties | T-2h before booking start |

### 3.8 Updated `AccountTypeChooser` flow

```text
Choose role
 ├─ Buyer        → /onboarding/buyer-prefs
 ├─ Pet parent   → /onboarding/add-pet
 ├─ Breeder/Org  → /onboarding/org
 ├─ Provider     → sub-picker (9 categories) → /onboarding/provider/:cat
 └─ Vet          → /vet/onboarding (existing)
```

### 3.9 Notification delivery checklist (per role)

| Role | Default channels | Key notification kinds |
|---|---|---|
| Pet parent | push + in-app | booking_status, job_offer_received, vet_answer, missing_pet_alert, mate_status, order_status, vaccination_due |
| Walker / Sitter | push + in-app | booking_new, job_nearby, job_accepted, schedule_reminder, payout_paid |
| Groomer / Trainer | push + in-app | booking_new, review_new, payout_paid |
| Daycare / Boarding | push + in-app + email | booking_new, vaccination_gate_blocked, capacity_alert |
| Caretaker | push + in-app | job_nearby (long-term), handover_due, daily_checkin_reminder |
| Driver | push (high-priority) | job_nearby, taxi_assigned, taxi_status, payout_paid |
| Vet | push + email | new_consult, appointment_booked, prescription_request |
| Shelter / NGO | push + email | adoption_application, donation_received, missing_pet_in_area |
| Admin | in-app + email | new_org_pending, new_provider_pending, report_filed, payment_failed |

### 3.10 Implementation order (smallest shippable first)

1. DB migration — new columns, `provider_documents`, `notification_preferences`
2. `AccountTypeChooser` extension + sub-picker
3. `/onboarding/provider/:category` wizard (steps 1–3) + storage bucket
4. Admin `/admin/provider-review` queue
5. `/provider` dashboard (read-only first, then on-duty toggle)
6. `job_posts` + `job_offers` migration
7. `/jobs/new`, `/jobs`, `/jobs/:id` pages
8. `tg_fanout_job_to_providers` trigger + `process-notification-jobs` extension for `job_fanout`
9. Notification preferences screen + enforcement in `notify_user`
10. Per-role notification kinds + push payload tweaks

## 4. Out of scope (explicit non-goals)

- Background-check vendor integration (we collect docs, an admin reviews manually).
- In-app chat between owner and provider before booking (already covered by existing `messages`).
- Native mobile push beyond web-push (PWA only at launch).
- Scheduling conflicts engine (calendar overlap detection) — phase 2.

## 5. Acceptance checks after build

- New user can sign up → choose "I offer services" → pick "Walker" → finish wizard → see "Pending verification" banner on `/provider`.
- Admin approves → walker receives `verification_approved` push.
- Owner posts a walking job 2 km away → walker sees it in `/jobs` within 1 cron cycle and gets a push.
- Walker sends offer → owner accepts → both get correct notifications, other offers auto-decline.
- Boarding host with `vaccination_strict=true` blocks a booking when pet is unvaccinated (uses existing `check_pet_boarding_eligible`).
- `notification_preferences` UI lets a user turn off `job_nearby` and they stop receiving them.

