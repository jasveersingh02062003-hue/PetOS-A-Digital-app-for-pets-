import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("unauthorized");

    const { appointmentId } = await req.json();
    if (!appointmentId) throw new Error("appointmentId required");

    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("id, vet_id, owner_id, mode, scheduled_at, duration_min, video_room_url, video_room_name")
      .eq("id", appointmentId)
      .single();
    if (aErr || !appt) throw new Error("appointment not found");
    if (appt.owner_id !== user.id && appt.vet_id !== user.id) throw new Error("forbidden");
    if (appt.mode !== "video") throw new Error("not a video appointment");

    let roomUrl = appt.video_room_url;
    let roomName = appt.video_room_name;

    if (!roomUrl) {
      // Create room: expires 2h after scheduled time
      const exp = Math.floor(new Date(appt.scheduled_at).getTime() / 1000) + (appt.duration_min + 120) * 60;
      const createRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            exp,
            enable_chat: true,
            enable_screenshare: true,
            max_participants: 4,
          },
        }),
      });
      const room = await createRes.json();
      if (!createRes.ok) throw new Error(`daily room create failed: ${JSON.stringify(room)}`);
      roomUrl = room.url;
      roomName = room.name;
      const service = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await service.from("appointments").update({
        video_room_url: roomUrl,
        video_room_name: roomName,
      }).eq("id", appointmentId);
    }

    // Mint meeting token for this user
    const isOwner = appt.owner_id === user.id;
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: isOwner ? "Owner" : "Vet",
          is_owner: !isOwner, // vet is the meeting owner
          exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
        },
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`daily token failed: ${JSON.stringify(tokenData)}`);

    return new Response(
      JSON.stringify({ url: roomUrl, token: tokenData.token, name: roomName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
