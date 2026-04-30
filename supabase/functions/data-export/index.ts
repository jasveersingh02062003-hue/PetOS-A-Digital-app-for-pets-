import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GDPR / DPDP data export.
 * Returns a JSON dump of every row owned by the calling user across the
 * tables they can interact with. The result is RLS-bound: the user's own
 * client (with their JWT) is what reads the data, so we cannot accidentally
 * leak someone else's records even if a table list grows.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tables we attempt to export. Missing tables (or RLS-empty results) are
// silently skipped — never throw because of catalog drift.
const EXPORT_TABLES = [
  "profiles",
  "pets",
  "posts",
  "post_comments",
  "post_likes",
  "stories",
  "vault_documents",
  "vaccinations",
  "appointments",
  "orders",
  "missing_pets",
  "mate_listings",
  "adoption_listings",
  "messages",
  "notifications",
  "reviews",
  "rewards_ledger",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  const dump: Record<string, unknown> = {
    _meta: {
      generated_at: new Date().toISOString(),
      user_id: userId,
      email: userData.user.email,
      schema_version: 1,
    },
  };

  for (const table of EXPORT_TABLES) {
    try {
      // RLS does the real filtering; we don't assume a specific FK column name.
      const { data, error } = await supabase
        .from(table)
        // deno-lint-ignore no-explicit-any
        .select("*" as any)
        .limit(5000);
      if (error) {
        dump[table] = { _error: error.message };
      } else {
        dump[table] = data ?? [];
      }
    } catch (e) {
      dump[table] = { _error: (e as Error)?.message ?? "unknown" };
    }
  }

  const filename = `petos-data-export-${userId.slice(0, 8)}-${Date.now()}.json`;
  return new Response(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});