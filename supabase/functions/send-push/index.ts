// supabase/functions/send-push/index.ts
// Sends a Web Push notification to all of a user's subscribed devices.
// Beta-safe: if VAPID keys are not configured, the function logs and returns
// success without throwing — your app keeps working.
//
// Env (set as project secrets when ready):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT  (e.g. "mailto:hello@petos.app")

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "npm:web-push@3.6.7";

interface PushBody {
  user_id: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@petos.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); } catch (_) {}
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as PushBody;
    if (!body?.user_id || !body?.title) return json(400, { error: "user_id and title are required" });

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.log("[send-push] VAPID keys not configured — skipping send (beta no-op).");
      return json(200, { ok: true, skipped: true, reason: "vapid_not_configured" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", body.user_id);

    if (error) return json(500, { error: error.message });
    if (!subs?.length) return json(200, { ok: true, sent: 0 });

    const payload = JSON.stringify({
      title: body.title,
      body: body.body ?? "",
      url: body.url ?? "/",
      tag: body.tag,
    });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
        else console.error("[send-push] error", code, e?.body);
      }
    }));

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return json(200, { ok: true, sent, removed: stale.length });
  } catch (e: any) {
    console.error("[send-push] fatal", e);
    return json(500, { error: e?.message ?? "unknown" });
  }
});
