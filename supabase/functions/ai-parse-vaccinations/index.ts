// AI vaccination parser — accepts a vaccine card (image, scan or PDF page rendered
// to image client-side) and returns a structured list of vaccinations the user can
// review before saving. Never writes to the database — the client confirms and inserts.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // multimodal, fast

type Parsed = {
  vaccine_name: string;
  administered_on: string | null;
  next_due_on: string | null;
  vet_name: string | null;
  batch_number: string | null;
  notes: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Auth — only signed-in users may use the parser
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      return json({ error: "imageDataUrl required (data:image/...;base64,...)" }, 400);
    }
    if (imageDataUrl.length > 8_000_000) {
      return json({ error: "image too large (max ~6MB base64)" }, 400);
    }

    const prompt = `You are a veterinary records assistant. Extract every vaccination entry visible in this image of a pet vaccination card or vet record.

Return JSON via the provided tool. Rules:
- One entry per administered vaccine. If a row shows both a date given AND a next-due date, that's still ONE entry.
- Use ISO format YYYY-MM-DD for dates. If only month+year is visible, use the 1st of that month. If a date is unreadable, set it to null.
- vaccine_name: short canonical name (e.g. "DHPPi", "Rabies", "Leptospirosis", "Bordetella", "FVRCP"). If only a brand is shown, include the brand.
- vet_name and batch_number are optional — use null if not visible.
- notes: include anything else useful (clinic, dosage, signature note). Keep under 200 chars.
- Skip rows that are clearly empty or just headers.
- If the image is not a vaccination record, return an empty list.`;

    const aiRes = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_vaccinations",
              description: "Return the structured vaccination entries extracted from the image.",
              parameters: {
                type: "object",
                additionalProperties: false,
                required: ["vaccinations"],
                properties: {
                  vaccinations: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["vaccine_name"],
                      properties: {
                        vaccine_name: { type: "string" },
                        administered_on: { type: ["string", "null"] },
                        next_due_on: { type: ["string", "null"] },
                        vet_name: { type: ["string", "null"] },
                        batch_number: { type: ["string", "null"] },
                        notes: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_vaccinations" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limit, try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable Cloud." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => "");
      return json({ error: `AI gateway error: ${aiRes.status} ${txt.slice(0, 200)}` }, 502);
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: Parsed[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        parsed = Array.isArray(args.vaccinations) ? args.vaccinations : [];
      } catch (_) { /* fall through */ }
    }

    // Normalise + cap at 30 entries
    const cleaned: Parsed[] = parsed.slice(0, 30).map((v) => ({
      vaccine_name: String(v.vaccine_name ?? "").trim().slice(0, 80) || "Unknown",
      administered_on: validDate(v.administered_on),
      next_due_on: validDate(v.next_due_on),
      vet_name: trimOrNull(v.vet_name, 80),
      batch_number: trimOrNull(v.batch_number, 50),
      notes: trimOrNull(v.notes, 200),
    })).filter((v) => v.vaccine_name && v.vaccine_name !== "Unknown");

    return json({ vaccinations: cleaned });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});

function validDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : s;
}
function trimOrNull(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().slice(0, max);
  return t.length ? t : null;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}