// Phase 16: AI proactive alerts cron.
// Runs every 6h. For each pet, inspects last 7 days of nutrition_logs, weights (pets.weight_kg history not stored,
// so we rely on weight_logs if present), and symptom_logs to write rule-based proactive alerts.
// Dedupes via dedupe_key per (user, pet, kind, day-bucket). Pushes via notify_user.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEdgeError, recordCronRun } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dayBucket(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let scanned = 0;
  let inserted = 0;

  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const today = dayBucket();

    const { data: pets, error: petErr } = await supabase
      .from("pets")
      .select("id, name, owner_id, weight_kg")
      .limit(2000);
    if (petErr) throw petErr;

    for (const pet of pets ?? []) {
      scanned++;
      const alerts: Array<{ kind: string; title: string; body: string; link: string; severity: number; dedupe_key: string }> = [];

      // Nutrition signal: count meals in last 24h vs prior 6-day average.
      const { data: nut } = await supabase
        .from("nutrition_logs")
        .select("fed_at, food, portion")
        .eq("pet_id", pet.id)
        .gte("fed_at", since)
        .order("fed_at", { ascending: false });

      if (nut && nut.length > 0) {
        const last24 = nut.filter((r) => Date.now() - new Date(r.fed_at).getTime() < 86400_000).length;
        const earlier = nut.length - last24;
        const avgPriorDay = earlier / 6;
        if (avgPriorDay >= 1 && last24 >= avgPriorDay + 2) {
          alerts.push({
            kind: "nutrition_overfeed",
            title: `${pet.name} ate more than usual`,
            body: `${last24} meals logged in 24h vs ~${avgPriorDay.toFixed(1)} avg. Watch for loose stools or vomiting.`,
            link: `/health?pet=${pet.id}&tab=nutrition`,
            severity: 2,
            dedupe_key: `nutrition_overfeed:${today}`,
          });
        }
        if (avgPriorDay >= 1 && last24 === 0) {
          alerts.push({
            kind: "nutrition_skipped",
            title: `${pet.name} hasn't eaten today`,
            body: `No meals logged in 24h. If they're refusing food >24h, contact a vet.`,
            link: `/health?pet=${pet.id}&tab=nutrition`,
            severity: 3,
            dedupe_key: `nutrition_skipped:${today}`,
          });
        }
      }

      // Symptom signal: any high-severity (>=4) in last 7d gets surfaced.
      const { data: symp } = await supabase
        .from("symptom_logs")
        .select("symptom, severity, logged_at")
        .eq("pet_id", pet.id)
        .gte("logged_at", since)
        .gte("severity", 4)
        .order("logged_at", { ascending: false })
        .limit(1);
      if (symp && symp.length > 0) {
        const s = symp[0];
        alerts.push({
          kind: "symptom_high",
          title: `${pet.name}: ${s.symptom}`,
          body: `Severity ${s.severity}/5 logged. Consider booking a vet consult.`,
          link: `/health?pet=${pet.id}&tab=symptoms`,
          severity: s.severity ?? 4,
          dedupe_key: `symptom_high:${today}`,
        });
      }

      // Insert + notify
      for (const a of alerts) {
        const { data: ins, error: insErr } = await supabase
          .from("proactive_alerts")
          .insert({
            user_id: pet.owner_id,
            pet_id: pet.id,
            kind: a.kind,
            title: a.title,
            body: a.body,
            link: a.link,
            severity: a.severity,
            dedupe_key: a.dedupe_key,
          })
          .select("id")
          .maybeSingle();
        if (insErr) {
          // dedupe collision = ignore
          if (!String(insErr.message || "").toLowerCase().includes("duplicate")) {
            await logEdgeError("ai-proactive-scan", insErr, { user_id: pet.owner_id, meta: { pet_id: pet.id, kind: a.kind } });
          }
          continue;
        }
        if (ins?.id) {
          inserted++;
          await supabase.rpc("notify_user", {
            _user_id: pet.owner_id,
            _type: "proactive_alert",
            _title: a.title,
            _body: a.body,
            _link: a.link,
          });
        }
      }
    }

    await recordCronRun("ai-proactive-scan", "ok");
    return new Response(JSON.stringify({ ok: true, scanned, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await logEdgeError("ai-proactive-scan", err);
    await recordCronRun("ai-proactive-scan", "error", String((err as Error)?.message ?? err));
    return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});