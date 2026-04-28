// AI photo analysis — vision-based skin / breed / general assessment of pet photos.
// Uses Lovable AI Gateway (Gemini multimodal). Returns structured JSON via tool calling.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // multimodal

type Mode = "skin" | "breed" | "general";

const TOOLS: Record<Mode, any> = {
  skin: {
    type: "function",
    function: {
      name: "analyze_skin",
      description: "Analyse a pet skin/coat photo for visible issues.",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["none", "mild", "moderate", "severe"] },
          findings: {
            type: "array",
            items: { type: "string" },
            description: "Up to 4 short findings (e.g. 'redness on belly', 'hair loss patch').",
          },
          possible_causes: {
            type: "array",
            items: { type: "string" },
            description: "Up to 3 possible benign causes (parasites, allergy, dryness).",
          },
          home_care: {
            type: "array",
            items: { type: "string" },
            description: "Up to 3 immediate at-home steps.",
          },
          recommend_vet: { type: "boolean" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["severity", "findings", "recommend_vet", "confidence"],
        additionalProperties: false,
      },
    },
  },
  breed: {
    type: "function",
    function: {
      name: "identify_breed",
      description: "Best-guess breed identification from a single photo.",
      parameters: {
        type: "object",
        properties: {
          species_guess: { type: "string", enum: ["dog", "cat", "other", "unknown"] },
          top_breeds: {
            type: "array",
            items: {
              type: "object",
              properties: {
                breed: { type: "string" },
                confidence_pct: { type: "number" },
              },
              required: ["breed", "confidence_pct"],
              additionalProperties: false,
            },
            description: "Top 1-3 breed guesses with rough confidence percentages.",
          },
          notes: { type: "string", description: "One-paragraph caveat or interesting trait." },
        },
        required: ["species_guess", "top_breeds"],
        additionalProperties: false,
      },
    },
  },
  general: {
    type: "function",
    function: {
      name: "analyze_general",
      description: "General mood / posture / wellness read of a pet photo.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", description: "e.g. 'relaxed', 'alert', 'anxious'." },
          posture: { type: "string" },
          observations: {
            type: "array",
            items: { type: "string" },
            description: "Up to 4 quick observations.",
          },
          recommend_vet: { type: "boolean" },
        },
        required: ["mood", "observations", "recommend_vet"],
        additionalProperties: false,
      },
    },
  },
};

const SYSTEMS: Record<Mode, string> = {
  skin: "You are Petos AI, a careful pet-health vision assistant. You are NOT a vet — never diagnose. Examine the photo and return a structured assessment via the analyze_skin tool. If the image is unclear, lower confidence. Always recommend a vet for moderate/severe findings or anything ambiguous.",
  breed: "You are Petos AI breed identifier. Identify the most likely breed(s) from the photo via the identify_breed tool. If mixed breed, list top guesses. If you cannot tell, say so.",
  general: "You are Petos AI. Read the pet's mood, posture, and visible context from the photo via the analyze_general tool. Be warm and observational, not diagnostic.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonErr("unauthenticated", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return jsonErr("unauthenticated", 401);

    const body = await req.json().catch(() => ({}));
    const mode: Mode = body.mode === "breed" ? "breed" : body.mode === "general" ? "general" : "skin";
    const imageUrl: string | undefined = typeof body.image_url === "string" ? body.image_url : undefined;
    const imageBase64: string | undefined = typeof body.image_base64 === "string" ? body.image_base64 : undefined;
    const note: string = typeof body.note === "string" ? body.note.slice(0, 500) : "";
    if (!imageUrl && !imageBase64) return jsonErr("image_url or image_base64 required", 400);

    // Tier gate — free users: 3 photo analyses per 30 days
    const { data: tierData } = await supabase.rpc("current_tier", { _user_id: userRes.user.id });
    const tier = (tierData as string) ?? "free";
    if (tier === "free") {
      const { data: usage, error: usageErr } = await supabase.rpc("increment_usage", {
        _kind: "ai_photo",
        _limit: 3,
        _window_days: 30,
      });
      if (usageErr) return jsonErr(usageErr.message, 500);
      if (usage && (usage as any).allowed === false) {
        return new Response(JSON.stringify({
          error: "You've used your 3 free photo analyses this month. Upgrade to Plus for unlimited.",
          code: "tier_limit",
          resets_at: (usage as any).resets_at,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const imageContent = imageBase64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

    const userText = note
      ? `Owner note: ${note}\n\nPlease analyse the photo and call the tool.`
      : "Please analyse the photo and call the tool.";

    const aiBody = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEMS[mode] },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            imageContent,
          ],
        },
      ],
      tools: [TOOLS[mode]],
      tool_choice: { type: "function", function: { name: TOOLS[mode].function.name } },
    };

    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(aiBody),
    });
    if (!r.ok) {
      if (r.status === 429) return jsonErr("Rate limit exceeded — please try again in a moment.", 429);
      if (r.status === 402) return jsonErr("AI credits exhausted. Add credits in Settings → Workspace → Usage.", 402);
      const t = await r.text().catch(() => "");
      console.error("AI gateway error", r.status, t);
      return jsonErr("AI gateway error", 500);
    }
    const json = await r.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) return jsonErr("AI returned no analysis", 500);

    return new Response(JSON.stringify({ mode, result: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-photo-analyze error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
