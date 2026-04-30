import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

const STATIC_PATHS = [
  "/",
  "/discover",
  "/mates",
  "/services",
  "/askvet",
  "/missing",
  "/meetups",
  "/groups",
  "/breeders",
  "/how-it-works",
  "/adopt",
  "/adopt/dog",
  "/adopt/cat",
  "/shop",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refunds",
];

const SERVICE_CATEGORIES = [
  "grooming","vet_clinic","training","boarding","daycare",
  "caretaker","sitting","walking","pet_taxi",
];
const POPULAR_CITIES = [
  "mumbai","delhi","bengaluru","hyderabad","chennai","kolkata",
  "pune","ahmedabad","jaipur","lucknow","chandigarh","kochi","goa",
];
const POPULAR_BREEDS = [
  ["dog","labrador-retriever"],["dog","golden-retriever"],["dog","german-shepherd"],
  ["dog","beagle"],["dog","pug"],["dog","pomeranian"],["dog","indie-pariah"],
  ["cat","persian"],["cat","siamese"],["cat","bengal"],
];

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || `${url.protocol}//${url.host}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const urls: { loc: string; lastmod?: string }[] = [];

  for (const p of STATIC_PATHS) urls.push({ loc: `${origin}${p}` });

  // Category permutations — services × city, adopt species/breed/city
  for (const cat of SERVICE_CATEGORIES) {
    for (const city of POPULAR_CITIES) {
      urls.push({ loc: `${origin}/services/${cat}/${city}` });
    }
  }
  for (const [species, breed] of POPULAR_BREEDS) {
    for (const city of POPULAR_CITIES) {
      urls.push({ loc: `${origin}/adopt/${species}/${breed}/${city}` });
    }
  }

  // Public pets
  const { data: pets } = await supabase.rpc("get_pets_public");
  for (const p of (pets ?? []) as any[]) {
    if (p.public_id) urls.push({ loc: `${origin}/p/${p.public_id}` });
  }

  // Pet listings (active) — adoption / rehoming / breeder sale
  const { data: pets_listings } = await supabase
    .from("pet_listings")
    .select("id, updated_at")
    .eq("active", true)
    .eq("status", "active")
    .limit(5000);
  for (const l of pets_listings ?? []) {
    urls.push({ loc: `${origin}/mates/adopt/${l.id}`, lastmod: (l as any).updated_at });
  }

  // Mating listings (active)
  const { data: mates } = await supabase
    .from("mating_listings")
    .select("id, updated_at")
    .eq("active", true)
    .limit(2000);
  for (const m of mates ?? []) {
    urls.push({ loc: `${origin}/mates/listing/${m.id}`, lastmod: (m as any).updated_at });
  }

  // Service providers (active)
  const { data: providers } = await supabase
    .from("service_providers")
    .select("id, updated_at")
    .eq("active", true)
    .limit(5000);
  for (const sp of providers ?? []) {
    urls.push({ loc: `${origin}/services/${sp.id}`, lastmod: (sp as any).updated_at });
  }

  // Verified breeders directory entries
  const { data: breeders } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .eq("breeder_verified", true)
    .limit(2000);
  for (const b of breeders ?? []) {
    urls.push({ loc: `${origin}/org/${b.id}`, lastmod: (b as any).updated_at });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});