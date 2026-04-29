// Phase 24 — daily cron: scan due shop_reminders, fan out proactive_alerts + push.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("shop_reminders")
    .select("id, user_id, pet_id, product_id, cadence_days, shop_products(title)")
    .eq("active", true)
    .lte("next_run_on", today);

  if (error) {
    console.error("scan error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  for (const r of due ?? []) {
    const title = (r as any).shop_products?.title ?? "your item";
    const link = `/shop?q=${encodeURIComponent(title)}`;

    await supabase.from("proactive_alerts").insert({
      user_id: r.user_id,
      pet_id: r.pet_id,
      kind: "shop_reorder",
      title: `Time to reorder ${title}`,
      body: `Based on your ${r.cadence_days}-day cycle, you'll run out soon. Tap to reorder.`,
      link,
      severity: 1,
      dedupe_key: `shop_reorder:${r.id}:${today}`,
    });

    try {
      await supabase.functions.invoke("send-push", {
        body: {
          user_id: r.user_id,
          title: `Reorder ${title}?`,
          body: "You're due to restock soon. Tap to view.",
          url: link,
        },
      });
    } catch (e) { console.warn("push failed", e); }

    const next = new Date();
    next.setDate(next.getDate() + r.cadence_days);
    await supabase
      .from("shop_reminders")
      .update({ last_notified_on: today, next_run_on: next.toISOString().slice(0, 10) })
      .eq("id", r.id);

    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
