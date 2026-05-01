import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "image/svg+xml; charset=utf-8",
  // 1h edge cache, browsers can keep it for a day. Reaction/comment counts
  // drift slightly but the share preview is throwaway content.
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

function esc(s: string) {
  return (s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

function clip(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Renders a 1200x630 share card for a single Petos post.
 *
 * Layout: brand strip + pet photo (left half, rounded) + identity (name in
 * display font, breed/age, vaccinated badge, city) + caption + 🐾/💬 tally.
 *
 * This is what shows up in WhatsApp/Twitter/Telegram link previews instead
 * of the generic favicon.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const postId = url.searchParams.get("id");
  if (!postId) return new Response("missing id", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: post } = await supabase
    .from("posts")
    .select("id, caption, image_url, image_url_feed, comment_count, reaction_counts, pet_snapshot, visibility")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.visibility !== "public") {
    return new Response("not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const snap = (post.pet_snapshot ?? {}) as Record<string, any>;
  const petName = esc(snap.name ?? "A pet");
  const breed = esc(snap.breed ?? "");
  const ageMonths = Number(snap.age_months ?? 0);
  const ageStr = !ageMonths ? "" : ageMonths < 12 ? `${ageMonths}mo` : `${Math.floor(ageMonths / 12)}y`;
  const vaccines = snap.vaccines_ok === true;
  const city = esc(snap.city ?? "");
  const caption = clip(esc(post.caption ?? ""), 110);
  const photo = post.image_url_feed ?? post.image_url ?? "";

  const reactionCounts = (post.reaction_counts ?? {}) as Record<string, number>;
  const totalPaws = Object.values(reactionCounts).reduce((s, n) => s + (Number(n) || 0), 0);
  const comments = Number(post.comment_count ?? 0);
  const breedLine = [breed, ageStr].filter(Boolean).join(" · ");

  const cityChipWidth = city ? 22 + Math.min(city.length, 24) * 12 + 16 : 0;
  const vaxX = 0;
  const cityX = vaccines ? 240 : 0;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fdf6ee"/>
      <stop offset="100%" stop-color="#f3e6d4"/>
    </linearGradient>
    <clipPath id="photoClip">
      <rect x="60" y="80" width="500" height="500" rx="36"/>
    </clipPath>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-opacity="0.18"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <text x="60" y="50" font-family="Georgia,serif" font-size="28" font-weight="700" fill="#7a3e1d" letter-spacing="2">PETOS</text>
  <text x="1140" y="50" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#a78b6a" letter-spacing="1">A SOCIAL HOME FOR PETS</text>
  <line x1="60" y1="62" x2="1140" y2="62" stroke="#e0c9a8" stroke-width="1"/>

  <g filter="url(#cardShadow)">
    <rect x="60" y="80" width="500" height="500" rx="36" fill="#f5e3c8"/>
  </g>
  ${photo
    ? `<image href="${esc(photo)}" x="60" y="80" width="500" height="500" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    : `<text x="310" y="365" text-anchor="middle" font-family="system-ui,sans-serif" font-size="120" fill="#d4b88a">🐾</text>`}

  <text x="610" y="170" font-family="Georgia,serif" font-size="78" font-weight="700" fill="#1f1407">${petName}</text>
  ${breedLine ? `<text x="610" y="216" font-family="system-ui,-apple-system,sans-serif" font-size="28" fill="#7c6448">${breedLine}</text>` : ""}

  <g transform="translate(610, 250)">
    ${vaccines ? `
      <rect x="${vaxX}" y="0" width="220" height="44" rx="22" fill="#e6f5ec" stroke="#9bd0b1" stroke-width="1"/>
      <text x="${vaxX + 22}" y="29" font-family="system-ui,sans-serif" font-size="22" fill="#1d6b3f" font-weight="600">✓ Vaccinated</text>
    ` : ""}
    ${city ? `
      <rect x="${cityX}" y="0" width="${cityChipWidth}" height="44" rx="22" fill="#fff" stroke="#e0c9a8" stroke-width="1"/>
      <text x="${cityX + 22}" y="29" font-family="system-ui,sans-serif" font-size="22" fill="#7c6448">📍 ${city}</text>
    ` : ""}
  </g>

  ${caption ? `<text x="610" y="370" font-family="Georgia,serif" font-size="32" font-style="italic" fill="#3a2a18">"${caption}"</text>` : ""}

  <g transform="translate(610, 500)">
    <text x="0" y="40" font-family="system-ui,-apple-system,sans-serif" font-size="40" font-weight="700" fill="#c2410c">🐾 ${totalPaws}</text>
    <text x="200" y="40" font-family="system-ui,-apple-system,sans-serif" font-size="40" font-weight="600" fill="#7c6448">💬 ${comments}</text>
  </g>

  <text x="60" y="610" font-family="system-ui,sans-serif" font-size="20" fill="#a78b6a">petos.app · See ${petName}'s moments</text>
</svg>`;

  return new Response(svg, { headers: corsHeaders });
});
