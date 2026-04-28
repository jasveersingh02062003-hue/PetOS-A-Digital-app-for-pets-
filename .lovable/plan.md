
## Phase 15 — Pet Insurance lead-capture & commission tracking

### Why this, why now
From your audit section G: *"❌ No insurance partner integration, no `insurance_policies` table, no commission tracking."* Verified — the only insurance code today is two text columns on `pets` (`insurance_provider`, `insurance_policy`) for the owner to self-record an existing policy. There is no lead funnel, no partner catalog, no commission log, no admin payout view.

It's the cleanest remaining revenue lane: no Stripe Connect (it's an affiliate/lead model), no hardware, no overlap with shipped phases (mating money, walker trust, recurring bookings, AI triage, vault PDF, presence, error telemetry, search history are all live).

### What gets built

1. **`insurance_partners` table** (admin-managed catalog)
   - name, logo_url, blurb, country, plan_min_inr, plan_max_inr, redirect_url (partner deep link with `{lead_id}` placeholder), commission_pct, active, sort_order.
   - Seed with two demo rows (Bajaj Allianz Pet, Digit Pet) marked inactive so admins can curate.

2. **`insurance_leads` table** (one row per "Get quote" tap)
   - user_id, pet_id, partner_id, status enum (`new`, `contacted`, `quoted`, `purchased`, `lost`), pet_breed_snapshot, pet_age_months_snapshot, premium_inr (nullable), commission_inr (nullable), partner_ref (nullable), notes, timestamps.
   - RLS: owner can SELECT/INSERT own; admins SELECT/UPDATE all; nobody can DELETE.
   - Trigger: snapshot pet breed + age at insert.

3. **Owner UI on Health page → new "Insurance" card**
   - Compact card under the existing pet hero (visible only when no `insurance_provider` set, otherwise shows current policy chip with "Compare other plans →").
   - Lists active partners (logo, blurb, price range, commission badge hidden from owners).
   - "Get a quote" button → inserts `insurance_leads` row, opens partner URL (with substituted `{lead_id}`) in new tab, toasts "We'll email you partner offers".

4. **Admin tab → "Insurance"**
   - Two sub-tabs: Partners (CRUD on `insurance_partners`), Leads (table with filters by status, inline status update + premium/commission entry).
   - KPI strip: leads this month, conversion %, commission accrued ₹.
   - Wired into existing `Admin.tsx` tab system (becomes 11th tab).

5. **Edge function `insurance-lead-create`** (lightweight, optional)
   - Owner-side could also POST through this to attach UTM/source headers; for v1 the client `supabase.from(...).insert()` is sufficient because RLS scopes to self. **Deferred** — direct insert is enough.

6. **Edge function `insurance-webhook`**
   - Public POST endpoint partners hit when a lead converts. Verifies a `x-petos-signature` header against `INSURANCE_PARTNER_SECRET` (stored as Supabase secret).
   - Updates `insurance_leads` row by `partner_ref`, sets status=`purchased`, premium, commission.
   - Returns 200 with idempotency on duplicate webhook ids.

### Files

- New migration with both tables, enums, RLS, triggers, seed (inactive).
- New: `src/components/health/InsuranceCard.tsx`.
- New: `src/components/admin/InsuranceTab.tsx` + `InsurancePartnersPanel.tsx` + `InsuranceLeadsPanel.tsx`.
- New: `supabase/functions/insurance-webhook/index.ts`.
- Edit: `src/pages/Health.tsx` — mount `<InsuranceCard petId={active.id} />` under the pet hero.
- Edit: `src/pages/Admin.tsx` — register the new tab.
- Secret: ask user to add `INSURANCE_PARTNER_SECRET` only when a real partner is wired (v1 uses a placeholder; webhook returns 401 until secret set).

### Acceptance

- An owner sees the Insurance card on Health, sees demo partners (after an admin enables them), taps "Get a quote", sees a row appear in `insurance_leads` with status=`new`, and is redirected to the partner URL with `lead_id` query param.
- A non-owner cannot read someone else's leads.
- Admin opens Insurance tab → sees the lead, marks it `purchased` with premium ₹6000 → commission auto-computed using partner's `commission_pct`.
- Webhook can flip a lead to `purchased` when called with valid signature.

### Out of scope (future phases)
Real partner contracts, automated payout reconciliation, in-app quote calculator (we redirect to partner site), embedded PDF policy delivery.

```text
Owner flow
──────────
Health page → Insurance card → "Get quote" → insert lead row
                                              │
                                              ├─ open partner URL with {lead_id}
                                              └─ toast confirmation

Partner-side conversion
──────────
Partner backend → POST /insurance-webhook (signed)
                  → update lead: status=purchased, premium, commission
                  → admin sees it next refresh
```
