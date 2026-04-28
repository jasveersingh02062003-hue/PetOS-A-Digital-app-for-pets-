import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS = [
  "Sleepy face right now",
  "Treat time! Show the begging eyes",
  "Caught mid-zoomies",
  "Today's derp face",
  "View from your walk",
  "Pet + their favorite spot",
  "Best yawn of the day",
  "Cuddle puddle",
  "Toy MVP this week",
  "Snack of the day",
  "What they're judging right now",
  "Window watcher mode",
  "Most dramatic stretch",
  "Belly up or curled tight?",
  "Show us their happy place",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Already dropped today?
    const { data: existing } = await supabase
      .from("daily_prompts")
      .select("id")
      .eq("prompt_date", today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ skipped: "already_dropped", date: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Random drop probability — cron runs hourly between 9am-9pm IST,
    // each hour has ~1/6 chance, ensuring ~1 drop per day on average.
    const hourUTC = new Date().getUTCHours();
    // Active window 03:30 UTC (9 IST) to 15:30 UTC (21 IST) ≈ hours 3..15
    if (hourUTC < 3 || hourUTC > 15) {
      return new Response(JSON.stringify({ skipped: "outside_window" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Math.random() > 1 / 5) {
      return new Response(JSON.stringify({ skipped: "rng" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const { data: inserted, error } = await supabase
      .from("daily_prompts")
      .insert({ prompt_date: today, prompt_text: prompt, dropped_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    // Notify users who opted in (limit fanout)
    const { data: users } = await supabase
      .from("profiles")
      .select("id, notif_prefs")
      .limit(5000);

    const recipients = (users ?? []).filter(
      (u: any) => u.notif_prefs?.push !== false,
    );

    for (const u of recipients) {
      await supabase.from("notifications").insert({
        user_id: u.id,
        type: "daily_prompt",
        title: "Pet Moment is live!",
        body: prompt,
        link: "/daily",
      });
    }

    return new Response(
      JSON.stringify({ ok: true, prompt: inserted, notified: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("drop-daily-prompt error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
