// AI caption suggester — given a draft + optional pet context, returns 3 caption ideas
// and 5 hashtag suggestions. Uses Lovable AI Gateway with tool calling.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite"; // fast & cheap for short generation

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
    const draft: string = typeof body.draft === "string" ? body.draft.slice(0, 500) : "";
    const petName: string | undefined = typeof body.pet_name === "string" ? body.pet_name.slice(0, 60) : undefined;
    const petSpecies: string | undefined = typeof body.pet_species === "string" ? body.pet_species.slice(0, 30) : undefined;
    const imageUrl: string | undefined = typeof body.image_url === "string" ? body.image_url : undefined;

    const userText = [
      `Draft: ${draft || "(none — write something fresh)"}`,
      petName ? `Pet: ${petName}${petSpecies ? ` (${petSpecies})` : ""}` : "",
      "Suggest 3 short, warm, scroll-stopping captions (max 100 chars each) in a friendly Indian-English tone, plus 5 relevant hashtags. Avoid emojis spam — at most 1 emoji per caption.",
    ].filter(Boolean).join("\n");

    const messages: any[] = [
      { role: "system", content: "You are Petos, a friendly social-post copywriter for pet parents. Generate authentic, non-cringe captions." },
      {
        role: "user",
        content: imageUrl
          ? [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageUrl } },
            ]
          : userText,
      },
    ];

    const aiBody = {
      model: MODEL,
      messages,
      tools: [{
        type: "function",
        function: {
          name: "suggest_captions",
          description: "Return 3 caption suggestions and 5 hashtags.",
          parameters: {
            type: "object",
            properties: {
              captions: {
                type: "array",
                items: { type: "string" },
                description: "Exactly 3 caption strings, each <= 100 characters.",
              },
              hashtags: {
                type: "array",
                items: { type: "string" },
                description: "5 hashtags without the # symbol.",
              },
            },
            required: ["captions", "hashtags"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_captions" } },
    };

    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(aiBody),
    });
    if (!r.ok) {
      if (r.status === 429) return jsonErr("Rate limit exceeded — please try again in a moment.", 429);
      if (r.status === 402) return jsonErr("AI credits exhausted.", 402);
      const t = await r.text().catch(() => "");
      console.error("AI gateway error", r.status, t);
      return jsonErr("AI gateway error", 500);
    }
    const json = await r.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) return jsonErr("AI returned no suggestions", 500);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-suggest-caption error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
