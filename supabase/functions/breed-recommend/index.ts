// Breed recommendation: takes quiz answers + a list of breed_profiles and
// asks Lovable AI to rank the best matches and breeds to avoid for this user.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    // Allow anonymous users to use the matchmaker
    /*
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    */

    const { answers } = await req.json();
    if (!answers || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "answers required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Fetch all breed profiles (small enough to inline)
    const { data: breeds } = await admin
      .from("breed_profiles")
      .select("species, breed, climate_fit, climate_warnings, monthly_cost_min, monthly_cost_max, exercise_hours_per_day, experience_level, good_with_kids, apartment_friendly, noise_level, short_summary, india_notes, common_health_issues")
      .limit(200);

    const breedCatalog = (breeds ?? []).slice(0, 200);

    const sys = `You are an expert Indian veterinarian and pet adoption counsellor. Given a user's lifestyle answers and a catalog of breed profiles across all species (dogs, cats, rabbits, birds, hamsters, fish, etc.), pick the 4 BEST matches and 3 breeds to AVOID. Be brutally honest about climate (India is hot). Consider apartment, kids, budget, experience, time. Mix species in recommendations when appropriate.`;

    const user_prompt = `USER ANSWERS:\n${JSON.stringify(answers, null, 2)}\n\nBREED CATALOG:\n${JSON.stringify(breedCatalog, null, 2)}`;

    const tool = {
      type: "function",
      function: {
        name: "recommend_breeds",
        description: "Return ranked best matches and avoid list",
        parameters: {
          type: "object",
          properties: {
            recommended: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  species: { type: "string" },
                  breed: { type: "string" },
                  match_score: { type: "integer", minimum: 0, maximum: 100 },
                  why_it_fits: { type: "string" },
                  monthly_cost_inr: { type: "string" },
                  energy_level: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["species", "breed", "match_score", "why_it_fits", "monthly_cost_inr", "energy_level"],
              },
            },
            avoid: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  species: { type: "string" },
                  breed: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["species", "breed", "reason"],
              },
            },
            owner_readiness: {
              type: "array",
              items: { type: "string" },
              description: "5-7 checklist items for being ready to bring a pet home",
            },
          },
          required: ["recommended", "avoid", "owner_readiness"],
        },
      },
    };

    const aiRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user_prompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "recommend_breeds" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await aiRes.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { recommended: [], avoid: [], owner_readiness: [] };

    // Save the response
    // Save the response if user is logged in
    if (user) {
      await admin.from("breed_quiz_responses").insert({
        user_id: user.id,
        answers,
        recommended_breeds: parsed.recommended,
        avoid_breeds: parsed.avoid,
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("breed-recommend error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
