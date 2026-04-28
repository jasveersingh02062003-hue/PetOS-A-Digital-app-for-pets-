# Stage 4 — AI Assistant + Tele-vet Handoff

Wires the AI chat to Lovable AI Gateway with real streaming, grounds every reply in the active pet's health vault, adds an Emergency triage that classifies severity, and creates a tele-vet handoff flow so moderate/severe cases land in a vet queue with the AI summary attached.

## What gets built

### 1. Database — new `vet_consults` table
Stores every tele-vet handoff created from the triage flow.

Columns: `pet_id`, `owner_id`, optional `vet_id`, `severity` (mild/moderate/severe), `status` (awaiting_vet → assigned → in_progress → completed → cancelled), `ai_summary`, `symptoms[]`, `prescription`, `notes`, `completed_at`.

Adds a `vet` value to the `app_role` enum.

Access rules in plain English:
- Owners can view, create, and cancel their own consults.
- Assigned vets (or anyone with the `vet` role) can view and update consults assigned to them.
- Super admins and moderators can view all.

### 2. Edge function — `supabase/functions/chat/index.ts`
- Reads the caller's pet vault (vaccinations, recent symptoms, recent records, pet bio) using their auth token, so RLS automatically scopes data.
- Builds a system prompt with that context + safe-pet-care guardrails (never prescribe, escalate emergencies).
- Two modes:
  - **`chat`** (default): streams tokens via SSE from Lovable AI Gateway (`google/gemini-3-flash-preview`).
  - **`triage`**: non-streaming structured tool call returning `{ severity, summary, recommend_vet, home_care[] }`.
- Surfaces 429 (rate limit) and 402 (out of credits) with friendly messages.

### 3. Frontend — full-screen chat at `/ai`
Replaces the placeholder `AiChat` page:
- Top bar with active-pet selector chip (uses `usePets` hook).
- Streaming token-by-token rendering of assistant replies (markdown via `react-markdown`).
- Composer with send button and disabled state while streaming.
- Suggested prompts on first open ("Diet for a 2-year-old Labrador", "He's scratching a lot", "When is the next vaccine due?").
- Toast on rate-limit / credit errors.

### 4. Emergency sheet upgrade
The floating Emergency button now opens an expanded sheet:
- Quick triage textarea ("What's happening?")
- Calls the `chat` function in `triage` mode → shows a colored severity banner (mild = sage, moderate = amber, severe = red), summary, and home-care steps.
- For moderate/severe: a primary **"Connect to vet"** button creates a row in `vet_consults` with the AI summary and routes to `/vet/consult/:id`.
- For mild: shows tips and a **"Open full chat"** button.

### 5. Tele-vet handoff screen — `/vet/consult/:id`
- Status pill (Awaiting vet · Assigned · In progress · Completed)
- Pet snapshot card (name, breed, age, verified badge)
- AI summary block
- Vault snapshot (latest vaccinations + recent symptoms — pulled live)
- Cancel button for the owner
- "Awaiting first available vet — we'll notify you" placeholder for v1 (real vet matching is Phase 2)

### 6. Health page integration
The "Recent consults" section on `/health` now lists real `vet_consults` rows with status pills, click-through to the consult screen.

## Technical details

- **Model**: `google/gemini-3-flash-preview` (fast, cheap, good for chat + triage). System prompt + pet RAG context built server-side; client never sees or sets the prompt.
- **Streaming**: SSE parsed line-by-line on the client (depth-tracked, handles CRLF, partial JSON, `[DONE]`, final flush).
- **Auth**: edge function reads JWT from `Authorization` header and uses an RLS-scoped Supabase client so the model can never see another user's pets.
- **`config.toml`**: adds a `[functions.chat]` block (default `verify_jwt`).
- **Validation**: messages array required; petId optional; mode whitelisted.
- **Rate limiting**: relies on Lovable AI Gateway's per-workspace limits; client-side toast on 429/402.

## Files

```text
NEW   supabase/migrations/<ts>_vet_consults.sql
NEW   supabase/functions/chat/index.ts
EDIT  supabase/config.toml          (add [functions.chat] block)
EDIT  src/pages/AiChat.tsx          (full streaming chat UI)
EDIT  src/components/EmergencySheet.tsx (triage mode)
NEW   src/pages/VetConsult.tsx      (handoff screen)
EDIT  src/pages/Health.tsx          (real consult list)
EDIT  src/App.tsx                   (route /vet/consult/:id)
```

No new dependencies — `react-markdown` is already installed.

## Out of scope this stage
- Real video tele-vet calls
- Vet matching / assignment automation
- AI image input (stool photo, X-rays)
- OCR vaccination parsing

These remain placeholders, called out in the PRD checklist for Phase 2.

## What I need from you
Just approval. No new secrets — `LOVABLE_API_KEY` is already provisioned.