import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const petId: string | undefined = body.pet_id;
    const range: "all" | "12m" | "6m" = body.range ?? "all";
    const includeOwner: boolean = !!body.include_owner;
    if (!petId) {
      return new Response(JSON.stringify({ error: "pet_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, public_id, owner_id, name, species, breed, gender, date_of_birth, vaccination_verified, bio, allergies, conditions, microchip_id, target_weight_kg, insurance_provider")
      .eq("id", petId)
      .maybeSingle();
    if (petErr || !pet) {
      return new Response(JSON.stringify({ error: "Pet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pet.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sinceIso = (() => {
      if (range === "all") return null;
      const d = new Date();
      d.setMonth(d.getMonth() - (range === "12m" ? 12 : 6));
      return d.toISOString();
    })();

    const [ownerProfile, records, vaccinations, weights, nutrition, symptoms, tier] = await Promise.all([
      supabase.from("profiles").select("full_name, city, phone").eq("id", user.id).maybeSingle(),
      (() => {
        let q = supabase.from("health_records").select("*").eq("pet_id", petId).order("occurred_on", { ascending: false }).limit(200);
        if (sinceIso) q = q.gte("occurred_on", sinceIso.slice(0, 10));
        return q;
      })(),
      supabase.from("vaccinations").select("*").eq("pet_id", petId).order("administered_on", { ascending: false }).limit(50),
      supabase.from("vital_logs").select("recorded_at, weight_kg, temperature_c").eq("pet_id", petId).not("weight_kg", "is", null).order("recorded_at", { ascending: true }).limit(60),
      supabase.from("nutrition_logs").select("*").eq("pet_id", petId).order("logged_at", { ascending: false }).limit(60),
      supabase.from("symptom_logs").select("*").eq("pet_id", petId).order("logged_at", { ascending: false }).limit(60),
      supabase.rpc("current_tier", { _user_id: user.id }),
    ]);

    const isPlus = (tier.data as unknown as string) === "plus";

    // Build PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595, 842];
    let page = pdf.addPage(A4);
    const margin = 48;
    let y = A4[1] - margin;
    const lineH = 14;

    const addPage = () => {
      page = pdf.addPage(A4);
      y = A4[1] - margin;
      drawWatermark();
    };
    const drawWatermark = () => {
      if (isPlus) return;
      page.drawText("PETOS — Free preview", {
        x: margin,
        y: 18,
        size: 9,
        font,
        color: rgb(0.7, 0.7, 0.7),
      });
    };
    const ensure = (need: number) => {
      if (y - need < margin) addPage();
    };
    const text = (s: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
      ensure(lineH);
      page.drawText(s.slice(0, 110), {
        x: margin,
        y,
        size: opts.size ?? 10,
        font: opts.bold ? fontBold : font,
        color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])),
      });
      y -= (opts.size ?? 10) + 4;
    };
    const heading = (s: string) => {
      ensure(28);
      y -= 8;
      page.drawText(s, { x: margin, y, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.12) });
      y -= 6;
      page.drawLine({
        start: { x: margin, y: y - 2 },
        end: { x: A4[0] - margin, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.88),
      });
      y -= 14;
    };
    const kv = (k: string, v: string) => {
      ensure(lineH);
      page.drawText(k, { x: margin, y, size: 10, font, color: rgb(0.45, 0.45, 0.5) });
      page.drawText(v, { x: margin + 110, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.12) });
      y -= lineH;
    };

    drawWatermark();

    // Cover
    page.drawText("Health Passport", { x: margin, y, size: 24, font: fontBold, color: rgb(0.1, 0.1, 0.12) });
    y -= 30;
    page.drawText(pet.name ?? "Pet", { x: margin, y, size: 18, font: fontBold, color: rgb(0.2, 0.4, 0.9) });
    y -= 24;
    if (pet.public_id) kv("Pet ID", String(pet.public_id));
    kv("Species", String(pet.species ?? "—"));
    if (pet.breed) kv("Breed", String(pet.breed));
    if (pet.gender) kv("Sex", String(pet.gender));
    if (pet.date_of_birth) kv("Born", fmt(pet.date_of_birth));
    if ((pet as any).microchip_id) kv("Microchip", String((pet as any).microchip_id));
    if ((pet as any).target_weight_kg) kv("Target weight", `${Number((pet as any).target_weight_kg).toFixed(1)} kg (${(Number((pet as any).target_weight_kg) * 2.2046).toFixed(1)} lb)`);
    kv("Vaccination verified", pet.vaccination_verified ? "Yes ✓" : "No");
    if ((pet as any).insurance_provider) {
      kv("Insurance", String((pet as any).insurance_provider));
    }
    if (includeOwner && ownerProfile.data) {
      kv("Owner", ownerProfile.data.full_name ?? "—");
      if (ownerProfile.data.city) kv("City", ownerProfile.data.city);
      if (ownerProfile.data.phone) kv("Phone", ownerProfile.data.phone);
    }
    kv("Generated", new Date().toISOString().slice(0, 16).replace("T", " "));
    if (range !== "all") kv("Range", range === "12m" ? "Last 12 months" : "Last 6 months");

    // Allergies & conditions — important for any vet reading the passport
    const allergies = ((pet as any).allergies ?? []) as string[];
    const conditions = ((pet as any).conditions ?? []) as string[];
    if (allergies.length || conditions.length) {
      heading("Allergies & conditions");
      if (allergies.length) text(`Allergies: ${allergies.join(", ")}`, { bold: true, color: [0.7, 0.45, 0.05] });
      if (conditions.length) text(`Conditions: ${conditions.join(", ")}`, { bold: true, color: [0.75, 0.15, 0.3] });
    }

    // Vaccinations
    heading("Vaccinations");
    if (!vaccinations.data || vaccinations.data.length === 0) {
      text("No vaccination records.", { color: [0.5, 0.5, 0.55] });
    } else {
      for (const v of vaccinations.data) {
        const verified = (v as any).verified ? " ✓" : "";
        text(`• ${(v as any).vaccine_name ?? "Vaccine"} — ${fmt((v as any).administered_on)}${verified}`, { bold: true });
        if ((v as any).next_due_on) text(`   Next due: ${fmt((v as any).next_due_on)}`, { size: 9, color: [0.4, 0.4, 0.45] });
        if ((v as any).clinic_name) text(`   Clinic: ${(v as any).clinic_name}`, { size: 9, color: [0.4, 0.4, 0.45] });
      }
    }

    // Weights — sparkline (kg, parenthesised lb for non-metric vets)
    heading("Weight history");
    if (!weights.data || weights.data.length === 0) {
      text("No weight measurements.", { color: [0.5, 0.5, 0.55] });
    } else {
      const w = (weights.data as Array<{ recorded_at: string; weight_kg: number }>).map((r) => ({
        measured_on: r.recorded_at,
        weight_kg: Number(r.weight_kg),
      }));
      const min = Math.min(...w.map((p) => Number(p.weight_kg)));
      const max = Math.max(...w.map((p) => Number(p.weight_kg)));
      const span = Math.max(0.1, max - min);
      const chartW = A4[0] - margin * 2;
      const chartH = 80;
      ensure(chartH + 24);
      const baseY = y - chartH;
      page.drawRectangle({
        x: margin,
        y: baseY,
        width: chartW,
        height: chartH,
        borderColor: rgb(0.88, 0.88, 0.92),
        borderWidth: 0.5,
      });
      // target line if known
      const target = (pet as any).target_weight_kg ? Number((pet as any).target_weight_kg) : null;
      if (target && target >= min && target <= max) {
        const ty = baseY + ((target - min) / span) * (chartH - 8) + 4;
        page.drawLine({ start: { x: margin, y: ty }, end: { x: margin + chartW, y: ty }, thickness: 0.5, color: rgb(0.85, 0.4, 0.4) });
      }
      for (let i = 0; i < w.length - 1; i++) {
        const x1 = margin + (i / (w.length - 1)) * chartW;
        const x2 = margin + ((i + 1) / (w.length - 1)) * chartW;
        const y1 = baseY + ((Number(w[i].weight_kg) - min) / span) * (chartH - 8) + 4;
        const y2 = baseY + ((Number(w[i + 1].weight_kg) - min) / span) * (chartH - 8) + 4;
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.2, color: rgb(0.2, 0.4, 0.9) });
      }
      y = baseY - 6;
      const minLb = (min * 2.2046).toFixed(1);
      const maxLb = (max * 2.2046).toFixed(1);
      text(`Range: ${min.toFixed(1)} kg (${minLb} lb) – ${max.toFixed(1)} kg (${maxLb} lb) · ${w.length} measurements · ${fmt(w[0].measured_on)} → ${fmt(w[w.length - 1].measured_on)}`, {
        size: 9,
        color: [0.4, 0.4, 0.45],
      });
      if (target) text(`Target: ${target.toFixed(1)} kg (${(target * 2.2046).toFixed(1)} lb)`, { size: 9, color: [0.7, 0.3, 0.3] });
    }

    // Health records
    heading("Health records");
    if (!records.data || records.data.length === 0) {
      text("No records in selected range.", { color: [0.5, 0.5, 0.55] });
    } else {
      for (const r of records.data as Array<any>) {
        text(`• ${fmt(r.occurred_on)} — ${r.title ?? r.record_type}`, { bold: true });
        if (r.notes) text(`   ${String(r.notes).slice(0, 140)}`, { size: 9, color: [0.4, 0.4, 0.45] });
      }
    }

    // Nutrition (last 60)
    heading("Nutrition log");
    if (!nutrition.data || nutrition.data.length === 0) {
      text("No nutrition entries.", { color: [0.5, 0.5, 0.55] });
    } else {
      for (const n of nutrition.data as Array<any>) {
        const parts = [n.brand, n.food_name, n.amount_g ? `${n.amount_g}g` : null].filter(Boolean).join(" · ");
        text(`• ${fmt(n.logged_at)} — ${parts || "Meal"}`);
      }
    }

    // Symptoms (last 60)
    heading("Symptom log");
    if (!symptoms.data || symptoms.data.length === 0) {
      text("No symptoms logged.", { color: [0.5, 0.5, 0.55] });
    } else {
      for (const s of symptoms.data as Array<any>) {
        text(`• ${fmt(s.logged_at)} — ${s.symptom ?? "Symptom"}${s.severity ? ` (severity ${s.severity})` : ""}`);
        if (s.notes) text(`   ${String(s.notes).slice(0, 140)}`, { size: 9, color: [0.4, 0.4, 0.45] });
      }
    }

    // Footer on every page
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Petos Health Passport · page ${i + 1} of ${pages.length}`, {
        x: margin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.55, 0.55, 0.6),
      });
    });

    const bytes = await pdf.save();
    const safeName = (pet.name ?? "pet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${safeName}-health-passport-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("health-export-pdf error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});