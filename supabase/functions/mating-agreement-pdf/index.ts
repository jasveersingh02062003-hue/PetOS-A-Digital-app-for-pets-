import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Generates a signed PDF for a fully-signed mating agreement and stores it in
 * the `agreements` storage bucket. Returns the storage path + signed URL.
 * Idempotent — re-runs replace the file at the same path.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { agreementId } = await req.json().catch(() => ({}));
    if (!agreementId || typeof agreementId !== "string") {
      return json({ error: "agreementId required" }, 400);
    }

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // user-scoped client to verify caller
    const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // service client for read + storage
    const admin = createClient(supaUrl, serviceKey);

    const { data: ag, error: agErr } = await admin
      .from("mating_agreements")
      .select("*")
      .eq("id", agreementId)
      .maybeSingle();
    if (agErr || !ag) return json({ error: "agreement not found" }, 404);
    if (!ag.from_signature || !ag.to_signature) {
      return json({ error: "agreement is not fully signed yet" }, 400);
    }

    const { data: req_, error: reqErr } = await admin
      .from("mating_requests")
      .select("id, from_owner_id, to_owner_id, from_pet_id, to_pet_id")
      .eq("id", ag.request_id)
      .single();
    if (reqErr || !req_) return json({ error: "request not found" }, 404);

    if (user.id !== req_.from_owner_id && user.id !== req_.to_owner_id) {
      return json({ error: "forbidden" }, 403);
    }

    const [{ data: fromPet }, { data: toPet }] = await Promise.all([
      admin.from("pets").select("name, breed, species").eq("id", req_.from_pet_id).maybeSingle(),
      admin.from("pets").select("name, breed, species").eq("id", req_.to_pet_id).maybeSingle(),
    ]);

    // Build PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width } = page.getSize();
    let y = 800;

    const draw = (text: string, opts: { size?: number; bold?: boolean; color?: any; x?: number } = {}) => {
      page.drawText(text, {
        x: opts.x ?? 48,
        y,
        size: opts.size ?? 11,
        font: opts.bold ? bold : font,
        color: opts.color ?? rgb(0.1, 0.1, 0.12),
      });
    };
    const wrap = (text: string, maxChars = 90): string[] => {
      const out: string[] = [];
      for (const para of text.split("\n")) {
        const words = para.split(" ");
        let line = "";
        for (const w of words) {
          if ((line + " " + w).trim().length > maxChars) { out.push(line.trim()); line = w; }
          else line = (line ? line + " " : "") + w;
        }
        if (line.trim()) out.push(line.trim());
        out.push("");
      }
      return out;
    };

    draw("Petos · Mating Intent Agreement", { size: 18, bold: true });
    y -= 22;
    draw(`Reference: ${ag.agreement_number ?? ag.id.slice(0, 8)}`, { size: 10, color: rgb(0.4,0.4,0.45) });
    y -= 14;
    draw(`Generated: ${new Date().toUTCString()}`, { size: 10, color: rgb(0.4,0.4,0.45) });
    y -= 26;

    // Pets section
    draw("Pets", { size: 13, bold: true }); y -= 16;
    draw(`Sire / From: ${fromPet?.name ?? "—"}  (${fromPet?.breed ?? fromPet?.species ?? "—"})`); y -= 14;
    draw(`Dam  / To:   ${toPet?.name ?? "—"}  (${toPet?.breed ?? toPet?.species ?? "—"})`); y -= 22;

    // Deal terms
    draw("Deal terms", { size: 13, bold: true }); y -= 16;
    draw(`Type: ${ag.deal_type ?? "free"}`); y -= 14;
    if (ag.stud_fee_inr) { draw(`Stud fee: INR ${Number(ag.stud_fee_inr).toLocaleString("en-IN")}`); y -= 14; }
    if (ag.puppy_split_owner_pct != null && ag.puppy_split_partner_pct != null) {
      draw(`Puppy split: ${ag.puppy_split_owner_pct}% / ${ag.puppy_split_partner_pct}%`); y -= 14;
    }
    if (ag.meeting_date)     { draw(`Meeting date: ${ag.meeting_date}`); y -= 14; }
    if (ag.meeting_location) { draw(`Meeting location: ${ag.meeting_location}`); y -= 14; }
    y -= 8;

    // Terms
    draw("Terms", { size: 13, bold: true }); y -= 16;
    for (const line of wrap(ag.terms_text ?? "", 95)) { draw(line, { size: 10 }); y -= 12; if (y < 200) break; }
    if (ag.extra_terms) {
      draw("Additional terms:", { size: 11, bold: true }); y -= 14;
      for (const line of wrap(ag.extra_terms, 95)) { draw(line, { size: 10 }); y -= 12; if (y < 180) break; }
    }

    // Signatures footer
    y = 130;
    page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.5, color: rgb(0.7,0.7,0.75) });
    y -= 18;
    draw("Signatures", { size: 13, bold: true }); y -= 18;
    draw(`From owner: ${ag.from_signature}   ·   ${new Date(ag.from_signed_at).toUTCString()}`, { size: 10 });
    y -= 14;
    draw(`To owner:   ${ag.to_signature}   ·   ${new Date(ag.to_signed_at).toUTCString()}`, { size: 10 });
    y -= 22;
    draw("This document is generated by Petos as a record of mutual intent.", { size: 9, color: rgb(0.45,0.45,0.5) });
    y -= 11;
    draw("Petos is not a party to any private arrangement, fee, or outcome.", { size: 9, color: rgb(0.45,0.45,0.5) });

    const bytes = await pdf.save();
    const path = `${ag.id}/agreement-${ag.agreement_number ?? "v1"}.pdf`;

    const { error: upErr } = await admin.storage
      .from("agreements")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await admin.storage.from("agreements").createSignedUrl(path, 60 * 60 * 24 * 365);

    await admin.from("mating_agreements")
      .update({ signed_pdf_url: path })
      .eq("id", ag.id);

    return json({ ok: true, path, signedUrl: signed?.signedUrl ?? null }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("mating-agreement-pdf error:", message);
    return json({ error: message }, 500);
  }

  function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});