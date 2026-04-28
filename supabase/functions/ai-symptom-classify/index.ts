// Phase 17: Classify a symptom log into watch | vet_soon | emergency.
// Auth required. Verifies the calling user owns the pet, then calls Lovable AI Gateway (gemini-2.5-flash, cheap+fast),
// updates the symptom_logs row, and on `emergency` writes a notification.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Flag = "watch" | "vet_soon" | "emergency";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j({ error: "unauthenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return j({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const logId = String(body?.log_id ?? "").trim();
    if (!logId) return j({ error: "missing log_id" }, 400);

    // Load the log + verify ownership of the parent pet.
    const { data: log, error: logErr } = await supabase
      .from("symptom_logs")
      .select("id, symptom, severity, notes, pet_id")
      .eq("id", logId)
      .maybeSingle();
    if (logErr || !log) return j({ error: "not_found" }, 404);

    const { data: pet } = await supabase
      .from("pets")
      .select("id, name, species, breed, owner_id, weight_kg")
      .eq("id", log.pet_id)
      .maybeSingle();
    if (!pet || pet.owner_id !== u.user.id) return j({ error: "forbidden" }, 403);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return j({ error: "ai_unavailable" }, 503);

    const sys = `You are a veterinary triage assistant. Classify a single pet symptom log into exactly one of:
- "emergency": life-threatening or needs an ER vet within hours (e.g., bleeding, seizures, collapse, vomiting blood, suspected poisoning, bloated abdomen, breathing trouble).
- "vet_soon": should see a vet within 24-48h (persistent vomiting, lethargy >24h, refusing food, mild but worsening signs).
- "watch": minor and self-limiting; monitor at home (single sneeze, mild itch, one normal stool variation).
Return JSON only: {"flag":"watch|vet_soon|emergency","reason":"max 140 chars, plain English"}.`;

    const userMsg = `Pet: ${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""}${pet.weight_kg ? `, ${pet.weight_kg}kg` : ""})
Symptom: ${log.symptom}
Severity (owner-rated 1-5): ${log.severity}
Notes: ${log.notes ?? "(none)"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return j({ error: "rate_limited" }, 429);
    if (aiRes.status === 402) return j({ error: "ai_credits_exhausted" }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return j({ error: "ai_error" }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { flag?: Flag; reason?: string } = {};
    try { parsed = JSON.parse(raw); } catch {
      console.error("Bad AI JSON", raw);
    }
    const flag: Flag = (["watch", "vet_soon", "emergency"] as const).includes(parsed.flag as Flag)
      ? (parsed.flag as Flag)
      : (log.severity >= 4 ? "vet_soon" : "watch");
    const reason = (parsed.reason ?? "").slice(0, 200) || "Auto-flagged based on severity.";

    // Update the log
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin
      .from("symptom_logs")
      .update({ ai_flag: flag, ai_reason: reason })
      .eq("id", logId);

    // Emergency → notify the owner.
    if (flag === "emergency") {
      await admin.rpc("notify_user", {
        _user_id: pet.owner_id,
        _type: "symptom_emergency",
        _title: `${pet.name}: possible emergency`,
        _body: reason,
        _link: `/health?pet=${pet.id}&tab=symptoms`,
      });
    }

    return j({ ok: true, flag, reason });
  } catch (e) {
    console.error("ai-symptom-classify", e);
    return j({ error: "internal" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}