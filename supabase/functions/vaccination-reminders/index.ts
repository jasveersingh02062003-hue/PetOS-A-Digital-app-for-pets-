// Daily cron: notify pet parents 5 days before a vaccination's next_due_on.
// De-duplicated via reminder_log so each vaccination only ever pings once for each kind.
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
    const start = new Date(today); start.setDate(start.getDate() + 4);
    const end = new Date(today); end.setDate(end.getDate() + 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const { data: due, error } = await supabase
      .from("vaccinations")
      .select("id, vaccine_name, next_due_on, pet_id, pets:pet_id(name, owner_id)")
      .gte("next_due_on", startStr)
      .lte("next_due_on", endStr);

    if (error) throw error;

    let sent = 0;
    for (const row of due ?? []) {
      const pet = (row as any).pets;
      if (!pet?.owner_id) continue;

      // Dedupe
      const { data: already } = await supabase
        .from("reminder_log")
        .select("vaccination_id")
        .eq("vaccination_id", row.id)
        .eq("kind", "vaccine_5d")
        .maybeSingle();
      if (already) continue;

      await supabase.rpc("notify_user", {
        _user_id: pet.owner_id,
        _type: "vaccine_due",
        _title: `${pet.name}'s ${row.vaccine_name} is due in 5 days`,
        _body: "Tap to plan the visit or share the vault with your vet.",
        _link: "/health",
      });

      await supabase.from("reminder_log").insert({
        vaccination_id: row.id,
        kind: "vaccine_5d",
      });
      sent++;
    }

    await recordCronRun("vaccination-reminders", "ok");
    return new Response(JSON.stringify({ ok: true, scanned: due?.length ?? 0, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vaccination-reminders error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    await logEdgeError("vaccination-reminders", e);
    await recordCronRun("vaccination-reminders", "error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
