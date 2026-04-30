## Goal

Transform PetOS from a "locked app" (auth wall, no public content) into a **discoverable marketplace** that buyers find on Google first, then convert into installed app users — all sharing the same email/account.

```text
Google search → Public listing page → "Contact seller" (email/OTP)
                       ↓                          ↓
                  Indexed by SEO              Auto-creates account
                                                   ↓
                                         Same email → Install PWA
                                                   ↓
                                          Full app, all data linked
```

---

## Phase A — Public, SEO-indexable listing pages

Make 4 listing types crawlable by Google **without login**:

1. **Adopt listings** — `/mates/adopt/:id`
2. **Mate (breeding) listings** — `/mates/listing/:id`
3. **Services** (groomer, walker, vet, trainer, taxi) — `/services/:id`
4. **Shop products** — `/shop` detail
5. **Org/Breeder/Shelter profiles** — `/org/:userId`, `/u/:userId`

For each:
- Remove auth gate; render core info (photo, breed, age, price, location, description, seller name + verified badge) to anonymous visitors.
- Sensitive actions (chat, exact address, phone) stay gated → trigger "Sign in to contact" sheet.
- Add `useSeo()` with title, description, OG image, JSON-LD (`Product`, `Offer`, `LocalBusiness`, `Pet` schema).
- Add breadcrumbs + canonical URL.

## Phase B — Public discovery hubs (category landing pages)

Buyers Google "Labrador puppy Pune" — we need pages that match that intent:

- `/adopt/:species/:breed/:city` — e.g. `/adopt/dog/labrador/pune`
- `/services/:category/:city` — e.g. `/services/grooming/mumbai`
- `/breeders/:breed/:city`
- `/shop/category/:slug`

Each is a server-friendly list page (rendered client-side but with full SEO meta + JSON-LD `ItemList`). Filterable, paginated, public.

Update `supabase/functions/sitemap/index.ts` to include all listing detail URLs + every active city × breed × category combination.

## Phase C — Frictionless capture (Google → contact → account)

When a logged-out visitor clicks **Contact seller / Book / Add to cart**:

1. Sheet opens: "Enter your email — we'll send a code".
2. Magic-link / OTP via Supabase passwordless auth (no password required).
3. On verify: account auto-created with that email, intent preserved (the message they were sending, the cart item, the booking slot) and executed immediately after auth.
4. Post-auth toast: "Account created. Install the app to track your conversation." → links to `/install`.

Same email used later in the installed PWA → same account, all conversations + saved listings already there. This is the unification you described.

## Phase D — Install nudge & retention loop

- After 1st successful contact: show install prompt (`beforeinstallprompt`) + push-notification opt-in ("Get a ping when seller replies").
- Email follow-up: "Your message was sent — install PetOS to chat live."
- Track funnel: `search_landing → contact_started → otp_verified → installed → second_session` in `analytics_events`.

## Phase E — Trust signals on public pages

Buyers are skeptical. Show, even when logged out:
- Verified badge, KYC status, response time, # of completed transactions, reviews/stars, "Bred on PetOS" ribbon, photos with EXIF date.
- Report button (anonymous reports allowed, rate-limited by IP).

---

## Technical details

**Routing**: move the 5 listing route groups *out* of `<FirstRunGate><AppShell />` in `src/App.tsx` so they render without the auth redirect. Keep `useAuth()` available for conditional CTAs.

**SEO**: extend `src/lib/seo.ts` with helpers `productJsonLd()`, `petJsonLd()`, `localBusinessJsonLd()`, `itemListJsonLd()`. Pre-render OG images via existing `og-image` and `og-pet` edge functions.

**RLS**: audit `adoption_listings`, `mate_listings`, `services`, `products`, `profiles`, `organizations` — add `SELECT` policy `USING (status = 'active' AND is_public = true)` for `anon` role on **public, non-PII columns only**. Phone/email/exact address stay restricted. Use a `public_*` view per table to enforce column-level safety.

**Auth UX**: new `<ContactSellerSheet />` component — accepts `intent` payload, calls `supabase.auth.signInWithOtp({ email })`, on success replays intent. Add `pending_intents` table keyed by email for cross-device safety.

**Sitemap**: rewrite `supabase/functions/sitemap/index.ts` to query active listings + generated category combos, chunked with `<sitemapindex>` if > 50k URLs.

**Category pages**: new `src/pages/discover/` directory with `AdoptCategory.tsx`, `ServiceCategoryCity.tsx`, `BreederCategory.tsx`. Use existing `useGeolocation`, `breeds.ts`, `serviceCategories.ts`.

**Analytics**: add events `public_listing_view`, `public_contact_started`, `otp_sent`, `otp_verified`, `intent_replayed`, `pwa_install_prompted`, `pwa_installed`.

**Tests**: extend Vitest with SEO snapshot tests + RLS read tests (anon can SELECT public rows, cannot SELECT PII columns).

---

## Out of scope (later)

- Server-side rendering (SSR/SSG) — current SPA + meta-tag injection is enough for Google; revisit only if Search Console shows indexing problems.
- Paid acquisition / Google Ads — organic SEO first.
- Multi-language SEO (hreflang) — English-only at launch.

---

## Deliverables

- 5 public listing routes + 4 category hub routes, all SEO-complete.
- Full sitemap auto-regenerating from DB.
- OTP "contact seller" flow with intent replay.
- Install prompt + push opt-in after first contact.
- RLS audit + public views.
- Analytics funnel from search → install.
- Tests + Lighthouse SEO score ≥ 95 on all public pages.

Approve to start with **Phase A** (highest leverage — unlocks Google indexing immediately), then B, C, D, E in order.
