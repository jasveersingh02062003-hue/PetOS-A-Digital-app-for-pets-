// Drains the notification_jobs queue in batches.
// Invoked by pg_cron (see notification_jobs_cron.sql) every minute.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25; // jobs per invocation
const RECIPIENTS_PER_JOB = 200; // safety cap per missing-pet fan-out

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Claim a batch
  const { data: jobs, error } = await admin
    .from("notification_jobs")
    .select("id, kind, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  for (const job of jobs) {
    await admin.from("notification_jobs")
      .update({ status: "processing", attempts: 1 })
      .eq("id", job.id);

    try {
      if (job.kind === "missing_pet_fanout") {
        await fanoutMissingPet(admin, job.payload);
      }
      await admin.from("notification_jobs")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("notification_jobs")
        .update({ status: "failed", last_error: msg })
        .eq("id", job.id);
      await admin.from("error_log").insert({
        source: "edge:process-notification-jobs",
        message: msg,
        meta: { job_id: job.id, kind: job.kind },
      });
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function fanoutMissingPet(admin: any, payload: any) {
  const { missing_pet_id, pet_id, owner_id, last_seen_city } = payload;
  if (!last_seen_city) return;

  const { data: pet } = await admin.from("pets")
    .select("name, species").eq("id", pet_id).maybeSingle();
  const petName = pet?.name ?? "a pet";
  const species = pet?.species ?? "pet";

  const { data: recipients } = await admin
    .from("profiles")
    .select("id")
    .neq("id", owner_id)
    .ilike("city", last_seen_city)
    .limit(RECIPIENTS_PER_JOB);

  if (!recipients?.length) return;

  // Batch insert via notify_user (respects per-user notification prefs)
  for (const r of recipients) {
    await admin.rpc("notify_user", {
      _user_id: r.id,
      _type: "missing_pet",
      _title: `Help find ${petName}`,
      _body: `${species} last seen in ${last_seen_city}`,
      _link: `/missing/${missing_pet_id}`,
    });
  }
}

function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
