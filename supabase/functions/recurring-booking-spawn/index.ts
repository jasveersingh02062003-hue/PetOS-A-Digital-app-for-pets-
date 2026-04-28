import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Look ahead window for which to spawn occurrences (days)
const HORIZON_DAYS = 14;

function nextOccurrencesFromAnchor(
  anchor: Date,
  weekdays: number[],
  frequency: "weekly" | "biweekly" | "monthly",
  timeOfDay: string, // HH:MM:SS
  startDate: Date,
  endDate: Date | null,
  horizon: Date,
): Date[] {
  const [hh, mm, ss] = timeOfDay.split(":").map((s) => parseInt(s, 10));
  const out: Date[] = [];
  const cursor = new Date(anchor);
  cursor.setHours(0, 0, 0, 0);
  const startMs = startDate.getTime();
  while (cursor <= horizon) {
    const dow = cursor.getDay(); // 0=Sun..6=Sat
    if (weekdays.includes(dow)) {
      const dt = new Date(cursor);
      dt.setHours(hh || 0, mm || 0, ss || 0, 0);
      if (
        dt.getTime() >= startMs &&
        (!endDate || dt <= endDate) &&
        dt >= anchor
      ) {
        // biweekly: only every other ISO week from start_date
        if (frequency === "biweekly") {
          const diffDays = Math.floor(
            (dt.getTime() - startDate.getTime()) / 86400000,
          );
          const weekIdx = Math.floor(diffDays / 7);
          if (weekIdx % 2 !== 0) {
            cursor.setDate(cursor.getDate() + 1);
            continue;
          }
        }
        if (frequency === "monthly") {
          // monthly: only first matching weekday occurrence in the month
          if (dt.getDate() > 7) {
            cursor.setDate(cursor.getDate() + 1);
            continue;
          }
        }
        out.push(dt);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + HORIZON_DAYS);

    const { data: schedules, error } = await supabase
      .from("recurring_bookings")
      .select("*")
      .eq("status", "active");
    if (error) throw error;

    let spawned = 0;
    let skipped = 0;

    for (const s of schedules ?? []) {
      const startDate = new Date(s.start_date + "T00:00:00");
      const endDate = s.end_date ? new Date(s.end_date + "T23:59:59") : null;
      const anchor = startDate > now ? startDate : now;

      const occurrences = nextOccurrencesFromAnchor(
        anchor,
        (s.weekdays as number[]) || [],
        s.frequency,
        s.time_of_day,
        startDate,
        endDate,
        horizon,
      );

      if (occurrences.length === 0) continue;

      // Existing future bookings for this schedule (avoid duplicates)
      const { data: existing } = await supabase
        .from("service_bookings")
        .select("scheduled_at")
        .eq("parent_recurring_id", s.id)
        .gte("scheduled_at", anchor.toISOString())
        .lte("scheduled_at", horizon.toISOString());

      const taken = new Set(
        (existing ?? []).map((b: { scheduled_at: string }) =>
          new Date(b.scheduled_at).toISOString(),
        ),
      );

      const rows = occurrences
        .filter((d) => !taken.has(d.toISOString()))
        .map((d) => ({
          provider_id: s.provider_id,
          customer_id: s.customer_id,
          pet_id: s.pet_id,
          scheduled_at: d.toISOString(),
          notes: s.notes,
          parent_recurring_id: s.id,
          status: "pending" as const,
        }));

      if (rows.length === 0) {
        skipped += occurrences.length;
        continue;
      }

      const { error: insErr } = await supabase
        .from("service_bookings")
        .insert(rows);
      if (insErr) {
        console.error("insert failed for schedule", s.id, insErr);
        continue;
      }
      spawned += rows.length;
      skipped += occurrences.length - rows.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        schedules: schedules?.length ?? 0,
        spawned,
        skipped,
        horizon_days: HORIZON_DAYS,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});