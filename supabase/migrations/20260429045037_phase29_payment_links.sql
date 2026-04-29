-- Phase 29 Batch A: link bookings/orders/listings to payment_intents

alter table public.transport_bookings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.service_bookings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.shop_orders
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.mating_listings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.vet_consults
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

create index if not exists idx_transport_bookings_payment_intent on public.transport_bookings(payment_intent_id);
create index if not exists idx_service_bookings_payment_intent on public.service_bookings(payment_intent_id);
create index if not exists idx_shop_orders_payment_intent on public.shop_orders(payment_intent_id);
create index if not exists idx_mating_listings_payment_intent on public.mating_listings(payment_intent_id);
create index if not exists idx_vet_consults_payment_intent on public.vet_consults(payment_intent_id);

create index if not exists idx_payment_intents_ref on public.payment_intents(ref_id, kind);
