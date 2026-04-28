// Public sitemap.xml generator. Lists static marketing routes and
// public DB-backed entities (pets, services, meetups, missing pets).
// Beta-safe: if any DB read fails, that section is skipped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/welcome", priority: 0.9, changefreq: "monthly" },
  { path: "/discover", priority: 0.8, changefreq: "daily" },
  { path: "/services", priority: 0.8, changefreq: "daily" },
  { path: "/meetups", priority: 0.7, changefreq: "daily" },
  { path: "/missing", priority: 0.7, changefreq: "hourly" },
  { path: "/shop", priority: 0.7, changefreq: "daily" },
  { path: "/install", priority: 0.5, changefreq: "monthly" },
  { path: "/legal/terms", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changefreq: "yearly" },
];

function urlEntry(loc: string, lastmod?: string, priority = 0.5, changefreq = "weekly") {
  return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") ?? `${url.protocol}//${url.host}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const entries: string[] = STATIC_ROUTES.map((r) =>
    urlEntry(`${origin}${r.path}`, undefined, r.priority, r.changefreq),
  );

  // Public pets
  try {
    const { data } = await supabase.rpc("get_pets_public").limit(500);
    (data ?? []).forEach((p: any) =>
      entries.push(urlEntry(`${origin}/pet/${p.id}`, p.updated_at, 0.6, "weekly")),
    );
  } catch (_) {}

  // Services
  try {
    const { data } = await supabase
      .from("services")
      .select("id, updated_at")
      .eq("is_active", true)
      .limit(500);
    (data ?? []).forEach((s: any) =>
      entries.push(urlEntry(`${origin}/services/${s.id}`, s.updated_at, 0.6, "weekly")),
    );
  } catch (_) {}

  // Meetups
  try {
    const { data } = await supabase
      .from("meetups")
      .select("id, updated_at")
      .gte("starts_at", new Date().toISOString())
      .limit(500);
    (data ?? []).forEach((m: any) =>
      entries.push(urlEntry(`${origin}/meetups/${m.id}`, m.updated_at, 0.6, "daily")),
    );
  } catch (_) {}

  // Missing pets
  try {
    const { data } = await supabase
      .from("missing_pets")
      .select("id, updated_at")
      .eq("status", "missing")
      .limit(500);
    (data ?? []).forEach((m: any) =>
      entries.push(urlEntry(`${origin}/missing/${m.id}`, m.updated_at, 0.8, "hourly")),
    );
  } catch (_) {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
