// generate-care-plan: For a given pet, generate a personalised day-by-day
// care timeline (feeding, vaccines, training, grooming, red flags) using
// care_plan_templates as a base and Lovable AI to personalise notes.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pet_id } = await req.json();
    if (!pet_id) {
      return new Response(JSON.stringify({ error: "pet_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: pet, error: petErr } = await admin
      .from("pets")
      .select("id, owner_id, name, species, breed, date_of_birth, approx_age_months, weight_kg")
      .eq("id", pet_id)
      .single();
    if (petErr || !pet) {
      return new Response(JSON.stringify({ error: "pet not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pet.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute DOB anchor
    let dob: Date;
    if (pet.date_of_birth) {
      dob = new Date(pet.date_of_birth);
    } else if (pet.approx_age_months) {
      dob = new Date();
      dob.setMonth(dob.getMonth() - pet.approx_age_months);
    } else {
      dob = new Date();
    }

    const ageWeeks = Math.max(0, Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    // Pull templates for this species (and matching breed or null)
    const { data: templates } = await admin
      .from("care_plan_templates")
      .select("*")
      .eq("species", pet.species)
      .or(`breed.is.null,breed.eq.${pet.breed ?? ""}`)
      .order("sort_order", { ascending: true });

    const tmpls = templates ?? [];

    // Build base items from templates
    const items: any[] = [];
    for (const t of tmpls) {
      let dueDate: Date;
      if (t.trigger_offset_days != null) {
        dueDate = addDays(dob, t.trigger_offset_days);
      } else {
        // Use midpoint of life stage as due date relative to DOB
        const midWeeks = Math.floor(((t.life_stage_weeks_min ?? 0) + (t.life_stage_weeks_max ?? 0)) / 2);
        dueDate = addDays(dob, midWeeks * 7);
      }
      // Skip items already too far in the past (>30 days ago)
      const daysAgo = (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo > 30) continue;

      items.push({
        pet_id: pet.id,
        owner_id: pet.owner_id,
        template_id: t.id,
        category: t.category,
        title: t.title,
        body: t.body,
        do_list: t.do_list ?? [],
        dont_list: t.dont_list ?? [],
        red_flags: t.red_flags ?? [],
        due_date: ymd(dueDate),
        premium_only: t.premium_only ?? false,
      });
    }

    // Optional AI personalisation: add 3 daily notes for the current age stage
    if (LOVABLE_API_KEY && items.length > 0) {
      try {
        const aiRes = await fetch(GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: "You are an expert Indian veterinarian giving practical care advice for pets. Keep notes short and India-specific." },
              { role: "user", content: `Pet: ${pet.name}, ${pet.species}, breed: ${pet.breed || "unknown"}, age: ${ageWeeks} weeks, weight: ${pet.weight_kg ?? "unknown"} kg.\n\nGive 3 short personalised care notes (1 sentence each) for THIS WEEK. JSON array of strings only.` },
            ],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          const txt = j?.choices?.[0]?.message?.content ?? "";
          const m = txt.match(/\[[\s\S]*\]/);
          if (m) {
            const notes: string[] = JSON.parse(m[0]);
            const today = ymd(new Date());
            notes.slice(0, 3).forEach((n, i) => {
              items.push({
                pet_id: pet.id,
                owner_id: pet.owner_id,
                category: "ai_tip",
                title: `Tip for ${pet.name} (this week)`,
                body: n,
                due_date: ymd(addDays(new Date(), i)),
                ai_personalised_note: n,
                premium_only: false,
              });
            });
          }
        }
      } catch (e) { console.error("AI personalisation skipped", e); }
    }

    // Wipe existing pending items and re-insert
    await admin.from("pet_care_plan_items").delete().eq("pet_id", pet.id).eq("status", "pending");
    if (items.length > 0) {
      const { error: insErr } = await admin.from("pet_care_plan_items").insert(items);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ generated: items.length, age_weeks: ageWeeks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-care-plan error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
