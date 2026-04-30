// supabase/functions/appointment-reminders/index.ts
// Cron-triggered: scans appointments / service_bookings / transport_bookings
// starting in ~25–35 minutes and queues a single reminder notification per
// booking. The notifications insert trigger (`tg_notifications_send_push`)
// fans the row out to Web Push. Deep-links go to the LIVE tracking surface
// so the user lands on the realtime page.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const minsUntil = (iso: string) =>
  Math.round((new Date(iso).getTime() - Date.now()) / 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 35 * 60_000).toISOString();

  let queued = 0;
  const errors: string[] = [];

  // ---- 1) Vet appointments (owner gets reminded) ---------------------------
  try {
    const { data: appts, error } = await admin
      .from("appointments")
      .select("id, owner_id, scheduled_at, mode")
      .is("reminder_sent_at", null)
      .in("status", ["confirmed", "requested"])
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd);
    if (error) throw error;

    for (const a of appts ?? []) {
      const mins = minsUntil(a.scheduled_at);
      const isVideo = a.mode === "video";
      await admin.from("notifications").insert({
        user_id: a.owner_id,
        type: "appointment_reminder",
        title: `🩺 Vet appointment in ${mins} min`,
        body: isVideo
          ? "Tap to join the video room when it opens."
          : "Get ready — your vet is expecting you shortly.",
        link: `/appointments/${a.id}`,
      });
      await admin
        .from("appointments")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", a.id);
      queued++;
    }
  } catch (e: any) {
    console.error("[reminders] appointments", e);
    errors.push(`appointments: ${e?.message ?? e}`);
  }

  // ---- 2) Service bookings (grooming, walks, training, etc.) ---------------
  try {
    const { data: bookings, error } = await admin
      .from("service_bookings")
      .select("id, customer_id, scheduled_at, service_providers(name, category)")
      .is("reminder_sent_at", null)
      .in("status", ["confirmed", "pending"])
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd);
    if (error) throw error;

    for (const b of bookings ?? []) {
      const mins = minsUntil(b.scheduled_at);
      const provider = (b as any).service_providers;
      const cat = provider?.category ?? "service";
      const name = provider?.name ?? "Your provider";
      await admin.from("notifications").insert({
        user_id: b.customer_id,
        type: "booking_reminder",
        title: `⏰ ${cat} in ${mins} min`,
        body: `${name} is on the way / expecting you shortly. Tap to track live.`,
        link: `/bookings/${b.id}`,
      });
      await admin
        .from("service_bookings")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", b.id);
      queued++;
    }
  } catch (e: any) {
    console.error("[reminders] service_bookings", e);
    errors.push(`service_bookings: ${e?.message ?? e}`);
  }

  // ---- 3) Transport / pet-taxi rides ---------------------------------------
  try {
    const { data: rides, error } = await admin
      .from("transport_bookings")
      .select("id, customer_id, scheduled_at, pickup_address")
      .is("reminder_sent_at", null)
      // transport_status enum: requested, accepted, en_route_pickup,
      // picked_up, en_route_drop, dropped_off, cancelled.
      .in("status", ["requested", "accepted", "en_route_pickup"])
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd);
    if (error) throw error;

    for (const r of rides ?? []) {
      const mins = minsUntil(r.scheduled_at);
      await admin.from("notifications").insert({
        user_id: r.customer_id,
        type: "ride_reminder",
        title: `🚖 Pet-taxi pickup in ${mins} min`,
        body: r.pickup_address
          ? `Pickup: ${String(r.pickup_address).slice(0, 60)}`
          : "Your driver will be at the pickup point soon.",
        link: `/taxi/${r.id}`,
      });
      await admin
        .from("transport_bookings")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", r.id);
      queued++;
    }
  } catch (e: any) {
    console.error("[reminders] transport_bookings", e);
    errors.push(`transport_bookings: ${e?.message ?? e}`);
  }

  return json(200, { ok: true, queued, errors });
});