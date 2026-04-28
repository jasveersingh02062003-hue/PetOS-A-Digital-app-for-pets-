// AI Chat edge function — streams replies from Lovable AI Gateway,
// grounded in the caller's pet vault. Also supports a `triage` mode
// that returns a structured severity classification via tool-calling.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : [];
    const petId: string | undefined = body.petId;
    const mode: "chat" | "triage" = body.mode === "triage" ? "triage" : "chat";

    if (!messages.length) return jsonErr("messages required", 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonErr("unauthenticated", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return jsonErr("unauthenticated", 401);

    // Pull vault context for the active pet (RLS scopes by caller)
    let petContext = "No specific pet selected.";
    if (petId) {
      const { data: pet } = await supabase
        .from("pets")
        .select("name, species, breed, date_of_birth, gender, weight_kg, neutered, vaccination_verified, bio")
        .eq("id", petId)
        .maybeSingle();
      if (pet) {
        const [{ data: vax }, { data: symp }, { data: rec }] = await Promise.all([
          supabase.from("vaccinations").select("vaccine_name, administered_on, next_due_on")
            .eq("pet_id", petId).order("administered_on", { ascending: false }).limit(8),
          supabase.from("symptom_logs").select("symptom, severity, notes, logged_at")
            .eq("pet_id", petId).order("logged_at", { ascending: false }).limit(10),
          supabase.from("health_records").select("title, record_type, notes, occurred_on")
            .eq("pet_id", petId).order("occurred_on", { ascending: false }).limit(8),
        ]);
        const ageY = pet.date_of_birth
          ? ((Date.now() - new Date(pet.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)).toFixed(1)
          : "unknown";
        petContext = [
          `Pet: ${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""})`,
          `Age: ${ageY} yrs · Gender: ${pet.gender ?? "?"} · Weight: ${pet.weight_kg ?? "?"} kg · Neutered: ${pet.neutered ? "yes" : "no"}`,
          `Vaccinations verified: ${pet.vaccination_verified ? "yes" : "no"}`,
          pet.bio ? `Bio: ${pet.bio}` : "",
          vax?.length
            ? `Recent vaccinations: ${vax.map((v: any) => `${v.vaccine_name} (${v.administered_on}${v.next_due_on ? `, next ${v.next_due_on}` : ""})`).join("; ")}`
            : "Vaccinations: none recorded",
          symp?.length
            ? `Recent symptoms: ${symp.map((s: any) => `${s.symptom} sev ${s.severity}/5 on ${new Date(s.logged_at).toISOString().slice(0, 10)}${s.notes ? ` (${s.notes})` : ""}`).join("; ")}`
            : "Symptoms: none logged recently",
          rec?.length
            ? `Recent records: ${rec.map((r: any) => `${r.title} [${r.record_type}] ${r.occurred_on}`).join("; ")}`
            : "Records: none",
        ].filter(Boolean).join("\n");
      }
    }

    const systemPrompt = `You are Petos AI, a calm and careful pet-health assistant for Indian pet parents.
Always:
- Use the pet context below to personalise answers.
- Be warm, plain-spoken, and concise. Short paragraphs and bullet points are great.
- If the situation could be a medical emergency (severe bleeding, seizures, collapse, breathing difficulty, suspected poisoning, bloated abdomen, repeated vomiting, hit by vehicle), say so up front and recommend an in-person vet immediately.
- Never invent dosages or prescribe medications. Suggest seeing a vet for any prescription.
- If asked about non-pet topics, politely redirect.

Pet context:
${petContext}`;

    if (mode === "triage") {
      const triageBody = {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "system", content: "Classify the latest user message and return triage via the classify_triage tool." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_triage",
            description: "Classify the urgency of the pet's situation",
            parameters: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                summary: { type: "string", description: "One-paragraph clinical summary suitable for a vet." },
                recommend_vet: { type: "boolean" },
                home_care: { type: "array", items: { type: "string" }, description: "Up to 3 immediate home-care steps." },
              },
              required: ["severity", "summary", "recommend_vet"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_triage" } },
      };
      const r = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(triageBody),
      });
      if (!r.ok) return passthroughError(r);
      const json = await r.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
      return new Response(JSON.stringify({ triage: args }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming chat
    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });
    if (!upstream.ok) return passthroughError(upstream);
    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function passthroughError(r: Response) {
  if (r.status === 429) return jsonErr("Rate limit exceeded — please try again in a moment.", 429);
  if (r.status === 402) return jsonErr("AI credits exhausted. Add credits in Settings → Workspace → Usage.", 402);
  const t = await r.text().catch(() => "");
  console.error("AI gateway error", r.status, t);
  return jsonErr("AI gateway error", 500);
}
