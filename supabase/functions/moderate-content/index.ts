// supabase/functions/moderate-content/index.ts
// Lightweight auto-moderation:
//  1) Banned-word fast-path (instant block)
//  2) Lovable AI Gateway (Gemini Flash Lite) classification
// Returns { verdict: 'allow'|'flag'|'block', reasons: string[], score?: number }
// Logs every call to public.content_moderation_log.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const BANNED = [
  // sexual exploitation / CSAM tripwires
  "child porn", "cp ", "csam", "loli", "shota",
  // explicit slurs (non-exhaustive — extend as needed)
  "n1gger", "f4ggot",
  // dangerous offers
  "free animal cruelty", "kill your pet",
];

type Verdict = "allow" | "flag" | "block";
interface ModResult { verdict: Verdict; reasons: string[]; score?: number }

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function bannedHit(text: string): string | null {
  const t = text.toLowerCase();
  for (const w of BANNED) if (t.includes(w)) return w;
  return null;
}

async function aiClassify(text: string): Promise<ModResult> {
  if (!LOVABLE_API_KEY) return { verdict: "allow", reasons: ["ai_disabled"] };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a strict but fair content moderator for a pet community app (Petos). " +
              "Classify the user's text. Respond ONLY with compact JSON: " +
              `{"verdict":"allow"|"flag"|"block","reasons":["..."],"score":0..1}. ` +
              "block = sexual content, child exploitation, animal cruelty/torture, hate speech, doxxing, real threats, illegal sales (drugs/weapons). " +
              "flag = mild profanity, light insults, spam, ads, off-topic. " +
              "allow = everything else. Keep reasons short tags (e.g. 'spam','profanity','animal_cruelty').",
          },
          { role: "user", content: text.slice(0, 4000) },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error("[moderate] AI gateway", res.status, await res.text().catch(() => ""));
      return { verdict: "allow", reasons: ["ai_unavailable"] };
    }
    const j = await res.json();
    const raw = j?.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const verdict: Verdict = ["allow", "flag", "block"].includes(parsed.verdict) ? parsed.verdict : "allow";
    return {
      verdict,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 6).map(String) : [],
      score: typeof parsed.score === "number" ? parsed.score : undefined,
    };
  } catch (e) {
    console.error("[moderate] parse failed", e);
    return { verdict: "allow", reasons: ["ai_parse_error"] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "unauthorized" });

  let body: { text?: string; content_type?: string; content_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const text = (body.text ?? "").toString();
  const contentType = (body.content_type ?? "post").toString();
  if (!text || text.trim().length < 1) return json(200, { verdict: "allow", reasons: [] });
  if (text.length > 8000) return json(400, { error: "too_long" });

  // 1) Banned word fast-path
  const hit = bannedHit(text);
  let result: ModResult;
  let source = "auto";
  if (hit) {
    result = { verdict: "block", reasons: ["banned_word", hit] };
    source = "banned_word";
  } else {
    result = await aiClassify(text);
  }

  // 2) Log (service role)
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from("content_moderation_log").insert({
      author_id: user.id,
      content_type: contentType,
      content_id: body.content_id ?? null,
      excerpt: text.slice(0, 280),
      verdict: result.verdict,
      reasons: result.reasons,
      score: result.score ?? null,
      source,
    });
  } catch (e) {
    console.error("[moderate] log failed", e);
  }

  return json(200, result);
});
