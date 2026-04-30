# Sprint UX1 — "E-commerce ease, pet-first soul"

Goal: every listing in Petos (Adopt, Mate, Services, Shop, Vets, Shelters) reads at a glance like an Amazon/Flipkart product tile — same hierarchy, same scan-in-1-second mental model — but uses **trust + identity badges** instead of discount stickers. One responsive UI serves both the public website and the installed PWA; visibility of CTAs adapts to auth state.

This sprint focuses on the **card system + supporting primitives** so all downstream pages inherit the same look automatically. Detail-page, checkout, and "recently viewed / wishlist rail" upgrades are queued as Sprint UX2.

---

## What we're shipping

### Phase UX1.A — The universal Listing Card

A single component `<ListingCard />` in `src/components/marketplace/ListingCard.tsx` that all four marketplaces reuse. Slot-based so each domain (puppy, stud, vet, product) can fill the badge row with its own facts.

Card anatomy (top → bottom):

```text
┌─────────────────────────────────┐
│  [16:9 hero · LazyImage]        │
│  ♡ wishlist (top-right)         │
│  🎗 Bred on PetOS (top-left)    │
├─────────────────────────────────┤
│  Title · 1 line, semibold       │
│  ₹ price  ·  📍 city · 3.2 km   │
│  ⭐ 4.9 (22)  🟢 Verified ✓     │
│  💉 Vaccinated  · 💊 Dewormed   │
│  [primary CTA pill, full-width] │
└─────────────────────────────────┘
```

Props:
- `image`, `title`, `price` (or `priceLabel`), `city`, `distanceKm`
- `rating?: { score, count }`
- `trustBadges: TrustBadge[]` (verified, bred-on-petos, vaccinated, KYC, etc.)
- `healthChips: string[]` (vaccinated, dewormed, microchipped, hip-tested…)
- `roleRing?: 'breeder'|'shelter'|'vet'|'walker'|'groomer'|'kennel'` (color-codes the avatar)
- `cta: { label, onClick, requiresAuth?: boolean }`
- `onWishlist?`, `wishlisted?`
- `density?: 'comfortable' | 'compact'` (compact = 2-up grid mobile; comfortable = 1-up rail/hero)

Behavior:
- If `requiresAuth` and user is logged out → CTA becomes "Sign in to contact" and routes via `<ContactSellerSheet>`.
- Wishlist heart hidden for logged-out visitors (replaced by "Save for later — sign in").
- Loading state uses an existing skeleton from `src/components/skeletons/`.
- Fully keyboard accessible; whole card is a link, CTA stops propagation.

### Phase UX1.B — Pet-first identity & trust primitives

Three small components (or refactors of existing ones) so every surface speaks the same visual language:

1. `<RoleRing avatar role="breeder" size="md" />` — wraps `<Avatar>` with a 2px color ring per role (breeder=amber, shelter=lilac, vet=emerald, walker=sky, groomer=rose, kennel=indigo). Reuses tokens already in `index.css`.
2. `<TrustChip kind="verified|bred-on-petos|kyc|health-tested" />` — single-line pill with icon + label, same shape across all cards. Refactors fragmented `BredOnPetosRibbon.tsx`, `PetVerifyBadge.tsx`, `SellerBadge.tsx`, `marketplace/HealthTestChip.tsx` under one visual API while keeping their existing imports working.
3. `<PriceTag value={35000} currency="INR" suffix="/visit" />` — Flipkart-style large numeral + small suffix, INR-aware formatting.

### Phase UX1.C — E-commerce browsing primitives

Plug these into the listing pages so the *browse* experience matches Amazon/Flipkart:

1. `<CategoryPills />` — horizontal scrolling pill row (already partially exists in `Shop.tsx`); promote to a shared component used by Shop, Services, Adopt, Mates.
2. `<FilterSheet />` — bottom sheet on mobile / right rail on desktop, with collapsible groups (Species, Breed, City + radius, Price range, Verification status, "Bred on PetOS only" toggle, Seller type, Vaccination). Reuses `ListingFilters.tsx` as a starting point.
3. `<SortMenu />` — dropdown with: Nearest, Newest, Top rated, Price low→high / high→low. Defaults to "Nearest" once `useUserLocation()` resolves.
4. `<ResultsHeader count={324} city="Mumbai" />` — Amazon-style "324 results in Mumbai · Delivers to 400001" line.

### Phase UX1.D — Apply the system

Swap legacy card markup → `<ListingCard />` on:
- `src/pages/Adopt.tsx` (and `AdoptGrid.tsx`)
- `src/pages/Mates.tsx` (`MatesGrid.tsx`)
- `src/pages/Services.tsx`
- `src/pages/Shop.tsx`
- `src/pages/Vets.tsx`
- `src/pages/Shelters.tsx`

Each page also gets the `<CategoryPills>` + `<SortMenu>` + `<ResultsHeader>` row so the browsing chrome is consistent.

### Phase UX1.E — Public vs. signed-in adaptation

One UI, two modes (no separate website codebase):

- Add a `useViewerMode()` hook returning `'guest' | 'member'`.
- `<BottomNav>` already hides for guests on a few routes — extend so guest mode hides composer, wishlist heart, and "Add to cart"; CTAs become "Sign in to continue".
- Add a slim top "Install app for the full experience" banner via the existing `InstallNudgeSheet`, shown only on guest web sessions (suppressed inside the installed PWA via `display-mode: standalone` media query).
- SEO meta on each public listing page already handled by `useSeo`; no change.

---

## Out of scope (queued for Sprint UX2)

- Detail-page redesign (hero carousel + "Seller's other listings" rail + reviews-with-verified-purchase tag).
- Checkout/booking 3-step wizard polish.
- Wishlist storage + "Recently viewed" horizontal rail on Home.
- Breeder/Vet/Kennel professional dashboard variant of Home.
- Any new database tables (this sprint is purely presentation; data already exists).

---

## Technical notes

- All colors via existing semantic tokens in `index.css` (`--primary`, `--muted`, role-ring tokens). No raw hex in components.
- Card uses `aspect-[16/9]` for hero, `LazyImage`, and respects `prefers-reduced-motion` for hover lift.
- Distance + city already provided by `useNearbyQuery` / `DistanceChip`; `<ListingCard>` just renders them.
- Wishlist hookup uses existing `marketplace/WishlistButton.tsx` — wired but its persistence layer is unchanged.
- No PWA / service-worker changes — install nudge is UI-only and gated by `matchMedia('(display-mode: standalone)')`.
- Backwards-compat: legacy components (`BredOnPetosRibbon`, `PetVerifyBadge`, etc.) keep their exports so unrelated screens don't break; internally they render `<TrustChip>`.

---

## Order of implementation

1. UX1.B primitives (RoleRing, TrustChip, PriceTag) — low risk, unblocks the rest.
2. UX1.A `<ListingCard>` + Storybook-style preview on a single page first (Shop) for visual sign-off.
3. UX1.C browsing chrome shared components.
4. UX1.D rollout across all six listing pages.
5. UX1.E guest-mode polish + install nudge.

After each phase I'll report a short progress note before moving on.
