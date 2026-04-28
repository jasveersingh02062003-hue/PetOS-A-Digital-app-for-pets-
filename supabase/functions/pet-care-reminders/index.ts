// Daily cron: notify pet owners about upcoming/overdue medications and parasite prevention.
// Dedupes via reminder_log so each item only pings once per kind.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEdgeError, recordCronRun } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in3Str = in3.toISOString().slice(0, 10);

    let sent = 0;
    let scanned = 0;

    // ---------- Parasite prevention (3 days before due, also overdue) ----------
    const { data: parasites, error: pErr } = await supabase
      .from("parasite_preventatives")
      .select("id, product_name, parasite_type, next_due_on, pet_id")
      .not("next_due_on", "is", null)
      .lte("next_due_on", in3Str);
    if (pErr) throw pErr;

    const petIds = Array.from(new Set((parasites ?? []).map((p) => p.pet_id)));
    const { data: pets } = await supabase
      .from("pets")
      .select("id, name, owner_id")
      .in("id", petIds.length ? petIds : ["00000000-0000-0000-0000-000000000000"]);
    const petMap = new Map((pets ?? []).map((p) => [p.id, p]));

    for (const row of parasites ?? []) {
      scanned++;
      const pet = petMap.get(row.pet_id);
      if (!pet?.owner_id) continue;
      const overdue = row.next_due_on < todayStr;
      const kind = overdue ? "parasite_overdue" : "parasite_3d";

      const { error: insErr } = await supabase
        .from("reminder_log")
        .insert({ kind, ref_id: row.id });
      if (insErr) continue; // duplicate => already sent

      await supabase.rpc("notify_user", {
        _user_id: pet.owner_id,
        _type: kind,
        _title: overdue
          ? `${pet.name}'s ${row.parasite_type} prevention is overdue`
          : `${pet.name}'s ${row.product_name} due in 3 days`,
        _body: "Tap Health to log the next dose.",
        _link: "/health",
      });
      sent++;
    }

    // ---------- Active medications without recent end date (daily nudge once) ----------
    // Notify when a med ends within next 3 days so owner can refill.
    const { data: meds, error: mErr } = await supabase
      .from("medication_logs")
      .select("id, name, end_on, pet_id")
      .eq("active", true)
      .not("end_on", "is", null)
      .gte("end_on", todayStr)
      .lte("end_on", in3Str);
    if (mErr) throw mErr;

    const medPetIds = Array.from(new Set((meds ?? []).map((m) => m.pet_id)));
    const { data: medPets } = await supabase
      .from("pets")
      .select("id, name, owner_id")
      .in("id", medPetIds.length ? medPetIds : ["00000000-0000-0000-0000-000000000000"]);
    const medPetMap = new Map((medPets ?? []).map((p) => [p.id, p]));

    for (const row of meds ?? []) {
      scanned++;
      const pet = medPetMap.get(row.pet_id);
      if (!pet?.owner_id) continue;

      const { error: insErr } = await supabase
        .from("reminder_log")
        .insert({ kind: "med_refill_3d", ref_id: row.id });
      if (insErr) continue;

      await supabase.rpc("notify_user", {
        _user_id: pet.owner_id,
        _type: "med_refill",
        _title: `${pet.name}'s ${row.name} ends in 3 days`,
        _body: "Plan a refill or vet check.",
        _link: "/health",
      });
      sent++;
    }

    await recordCronRun("pet-care-reminders", "ok");
    return new Response(JSON.stringify({ ok: true, scanned, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pet-care-reminders error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    await logEdgeError("pet-care-reminders", e);
    await recordCronRun("pet-care-reminders", "error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
