// Lightweight Open Graph image generator. Returns an SVG that any social
// crawler can render. Query params: ?title=...&subtitle=...&emoji=🐾
// SVG keeps the function dependency-free and fast.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "Petos").slice(0, 80);
  const subtitle = (url.searchParams.get("subtitle") ?? "A complete digital life for your pet").slice(
    0,
    120,
  );
  const emoji = url.searchParams.get("emoji") ?? "🐾";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7f4ed"/>
      <stop offset="1" stop-color="#ecdfc7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="80" y="150" font-family="-apple-system, Segoe UI, sans-serif" font-size="120">${emoji}</text>
  <text x="80" y="340" font-family="-apple-system, Segoe UI, sans-serif" font-size="72" font-weight="800" fill="#1a1a1a">${escapeXml(
    title,
  )}</text>
  <text x="80" y="420" font-family="-apple-system, Segoe UI, sans-serif" font-size="36" fill="#4a4a4a">${escapeXml(
    subtitle,
  )}</text>
  <text x="80" y="560" font-family="-apple-system, Segoe UI, sans-serif" font-size="28" font-weight="700" fill="#7a5a2a">Petos</text>
</svg>`;

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
