import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=86400",
};

function esc(s: string) {
  return (s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const publicId = url.searchParams.get("id");
  if (!publicId) return new Response("missing id", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pets } = await supabase.rpc("get_pets_public");
  const pet = ((pets ?? []) as any[]).find((p) => p.public_id === publicId);
  if (!pet) return new Response("not found", { status: 404 });

  const name = esc(pet.name || "Pet");
  const breed = esc(pet.breed || pet.species || "");
  const city = esc(pet.city || "");
  const verified = pet.vaccination_verified ? "✓ Verified" : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7ed"/>
      <stop offset="100%" stop-color="#fed7aa"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="80" y="120" font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="600" fill="#9a3412">PETOS</text>
  <g filter="url(#shadow)">
    <rect x="80" y="180" width="1040" height="370" rx="32" fill="white"/>
  </g>
  <text x="120" y="290" font-family="system-ui,-apple-system,sans-serif" font-size="84" font-weight="700" fill="#1c1917">${name}</text>
  <text x="120" y="360" font-family="system-ui,-apple-system,sans-serif" font-size="36" fill="#57534e">${breed}${city ? " · " + city : ""}</text>
  ${verified ? `<text x="120" y="450" font-family="system-ui,-apple-system,sans-serif" font-size="28" font-weight="600" fill="#16a34a">${verified}</text>` : ""}
  <text x="120" y="510" font-family="system-ui,-apple-system,sans-serif" font-size="24" fill="#78716c">petos.app/p/${esc(publicId)}</text>
</svg>`;

  return new Response(svg, { headers: corsHeaders });
});