import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily auto-milestone job.
 *
 * For every pet whose `date_of_birth`'s month+day matches today and whose
 * owner hasn't opted out (`auto_milestones = true`), insert a `kind = 'milestone'`
 * post on the owner's behalf saying "Pet turned N today 🎂".
 *
 * Each post is tagged with `pet_snapshot.auto_milestone_key = 'birthday-{year}'`
 * so the dedup index prevents double-posting if the cron runs twice.
 *
 * Triggered by pg_cron daily.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");

  // Pets with a DOB whose month/day matches today and auto_milestones=true
  const { data: pets, error: petsErr } = await supabase
    .from("pets")
    .select("id, name, owner_id, date_of_birth, breed, species, avatar_url, vaccination_verified")
    .eq("auto_milestones", true)
    .not("date_of_birth", "is", null);

  if (petsErr) {
    return new Response(JSON.stringify({ error: petsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const todayMd = `${mm}-${dd}`;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pet of pets ?? []) {
    if (!pet.date_of_birth || !pet.owner_id) continue;
    const dob = String(pet.date_of_birth); // YYYY-MM-DD
    const dobMd = dob.slice(5, 10);
    if (dobMd !== todayMd) continue;

    const dobYear = Number(dob.slice(0, 4));
    const ageYears = yyyy - dobYear;
    if (ageYears < 1) continue; // skip 0th birthday — pet was born today

    const milestoneKey = `birthday-${yyyy}-${pet.id}`;

    // Dedup — index makes this O(1)
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("pet_snapshot->>auto_milestone_key", milestoneKey)
      .limit(1)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const ageMonths = ageYears * 12;
    const caption = ageYears === 1
      ? `${pet.name} is 1 today! 🎂`
      : `${pet.name} turned ${ageYears} today! 🎂`;

    const petSnapshot = {
      name: pet.name,
      breed: pet.breed,
      age_months: ageMonths,
      avatar_url: pet.avatar_url,
      vaccines_ok: pet.vaccination_verified ?? null,
      auto_milestone_key: milestoneKey,
      auto_milestone_kind: "birthday",
    };

    const { error: insertErr } = await supabase.from("posts").insert({
      author_id: pet.owner_id,
      pet_id: pet.id,
      caption,
      kind: "milestone",
      visibility: "public",
      pet_snapshot: petSnapshot,
    });

    if (insertErr) {
      errors.push(`${pet.id}: ${insertErr.message}`);
    } else {
      created++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, date: `${yyyy}-${mm}-${dd}`, created, skipped, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
