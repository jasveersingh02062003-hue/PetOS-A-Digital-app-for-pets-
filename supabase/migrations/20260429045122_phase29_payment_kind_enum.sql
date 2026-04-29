-- Phase 29 Batch A: extend payment_kind enum with booking categories
alter type public.payment_kind add value if not exists 'transport';
alter type public.payment_kind add value if not exists 'service';
alter type public.payment_kind add value if not exists 'shop';
alter type public.payment_kind add value if not exists 'mating';
alter type public.payment_kind add value if not exists 'subscription';
alter type public.payment_kind add value if not exists 'donation';
alter type public.payment_kind add value if not exists 'boost';
