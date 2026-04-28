import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Insight = {
  kind: string;
  severity: "info" | "watch" | "action";
  title: string;
  detail: string;
  cta_link?: string;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const petId: string | undefined = body?.pet_id;
    const force: boolean = !!body?.force;
    if (!petId) {
      return new Response(JSON.stringify({ error: "pet_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify ownership
    const { data: pet, error: petErr } = await admin
      .from("pets")
      .select(
        "id, name, species, breed, gender, date_of_birth, owner_id, vaccination_verified, neutered",
      )
      .eq("id", petId)
      .maybeSingle();
    if (petErr || !pet || pet.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull recent data
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const [weights, nutrition, symptoms, vax, meds] = await Promise.all([
      admin
        .from("vital_logs")
        .select("weight_kg, recorded_at")
        .eq("pet_id", petId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(50),
      admin
        .from("nutrition_logs")
        .select("food, portion, fed_at")
        .eq("pet_id", petId)
        .gte("fed_at", since)
        .order("fed_at", { ascending: false })
        .limit(100),
      admin
        .from("symptom_logs")
        .select("symptom, severity, ai_flag, ai_reason, logged_at")
        .eq("pet_id", petId)
        .gte("logged_at", since)
        .order("logged_at", { ascending: false })
        .limit(50),
      admin
        .from("vaccinations")
        .select("vaccine_name, administered_on, next_due_on")
        .eq("pet_id", petId)
        .order("administered_on", { ascending: false })
        .limit(20),
      admin
        .from("medication_logs")
        .select("name, dose, frequency, active, end_on")
        .eq("pet_id", petId)
        .limit(20),
    ]);

    const payload = {
      pet: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        dob: pet.date_of_birth,
        vaccination_verified: pet.vaccination_verified,
        neutered: pet.neutered,
      },
      weights: weights.data ?? [],
      nutrition: nutrition.data ?? [],
      symptoms: symptoms.data ?? [],
      vaccinations: vax.data ?? [],
      medications: meds.data ?? [],
    };

    const sig = await sha256Hex(JSON.stringify(payload));

    // Cache hit?
    if (!force) {
      const { data: cached } = await admin
        .from("health_insights")
        .select("*")
        .eq("pet_id", petId)
        .maybeSingle();
      if (
        cached &&
        cached.data_signature === sig &&
        new Date(cached.generated_at).getTime() >
          Date.now() - 12 * 3600 * 1000
      ) {
        return new Response(
          JSON.stringify({ cached: true, insight: cached }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Call Lovable AI Gateway
    const system = `You are a veterinary health analyst. Given recent pet data, return a concise JSON object with:
- summary: 1-2 sentences in plain English about overall health trend.
- insights: an array (max 5) of objects { kind, severity, title, detail, cta_link }.
  - kind: one of weight_trend, nutrition, symptom, vaccination, medication, general
  - severity: "info" | "watch" | "action"
  - title: short (under 60 chars)
  - detail: 1-2 sentences, factual, kind, never alarmist
  - cta_link: optional in-app path like "/health" or "/ai" or "/vet"
Be conservative — never diagnose. Recommend vet consult for severity:"action".`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "rate_limited" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "credits_exhausted" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(
        JSON.stringify({ error: "ai_error", detail: t.slice(0, 200) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; insights?: Insight[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      parsed = { summary: "Insights unavailable.", insights: [] };
    }
    const summary = parsed.summary ?? "No notable changes detected.";
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 5)
      : [];

    const { data: upserted, error: upErr } = await admin
      .from("health_insights")
      .upsert(
        {
          pet_id: petId,
          owner_id: user.id,
          summary,
          insights,
          data_signature: sig,
          generated_at: new Date().toISOString(),
          model: "google/gemini-2.5-flash",
        },
        { onConflict: "pet_id" },
      )
      .select()
      .single();

    if (upErr) {
      return new Response(
        JSON.stringify({ error: "save_failed", detail: upErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ cached: false, insight: upserted }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});