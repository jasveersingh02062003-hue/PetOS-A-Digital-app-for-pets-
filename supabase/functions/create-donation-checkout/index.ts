 // Variable-amount donation checkout to a verified org. Creates a donation row
 // and either marks it beta_free (no Stripe configured) or redirects to a
 // Stripe Checkout session for a one-time custom-amount payment.
 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
 import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const authHeader = req.headers.get("Authorization");
     if (!authHeader?.startsWith("Bearer ")) return jsonErr("unauthenticated", 401);
 
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
       { global: { headers: { Authorization: authHeader } } },
     );
     const { data: userRes } = await supabase.auth.getUser();
     if (!userRes?.user) return jsonErr("unauthenticated", 401);
     const userId = userRes.user.id;
 
     const body = await req.json().catch(() => ({}));
     const orgUserId = String(body?.org_user_id ?? "");
     const amount = Math.floor(Number(body?.amount_inr ?? 0));
     const message = body?.message ? String(body.message).slice(0, 280) : null;
     const anonymous = !!body?.anonymous;
 
     if (!orgUserId) return jsonErr("missing org_user_id", 400);
     if (orgUserId === userId) return jsonErr("cannot donate to yourself", 400);
     if (!amount || amount < 10 || amount > 500000)
       return jsonErr("amount must be between 10 and 500000", 400);
 
     // Verify org is approved
     const { data: org } = await supabase
       .from("org_profiles")
       .select("user_id, status, org_name, org_type")
       .eq("user_id", orgUserId)
       .maybeSingle();
     if (!org || org.status !== "approved")
       return jsonErr("org is not verified", 400);
     if (!["shelter", "sanctuary", "rescuer", "ngo"].includes(String(org.org_type)))
       return jsonErr("only NGOs/shelters/rescuers can receive donations", 400);
 
     const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
 
     if (!STRIPE_SECRET_KEY) {
       const { data: donation, error } = await supabase
         .from("donations")
         .insert({
           donor_id: userId,
           org_user_id: orgUserId,
           amount_inr: amount,
           message,
           anonymous,
           status: "beta_free",
         })
         .select("id")
         .single();
       if (error) return jsonErr(error.message, 500);
       return jsonOk({ status: "beta_free", donation_id: donation?.id });
     }
 
     const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
     const origin = req.headers.get("origin") ?? new URL(req.url).origin;
 
     const { data: pending, error: pendErr } = await supabase
       .from("donations")
       .insert({
         donor_id: userId,
         org_user_id: orgUserId,
         amount_inr: amount,
         message,
         anonymous,
         status: "pending",
       })
       .select("id")
       .single();
     if (pendErr) return jsonErr(pendErr.message, 500);
 
     const session = await stripe.checkout.sessions.create({
       mode: "payment",
       line_items: [
         {
           price_data: {
             currency: "inr",
             unit_amount: amount * 100,
             product_data: {
               name: `Donation to ${org.org_name}`,
               description: message?.slice(0, 200) ?? undefined,
             },
           },
           quantity: 1,
         },
       ],
       client_reference_id: userId,
       customer_email: userRes.user.email ?? undefined,
       success_url: `${origin}/org/${orgUserId}?donated=1`,
       cancel_url: `${origin}/org/${orgUserId}?cancelled=1`,
       metadata: {
         user_id: userId,
         kind: "donation",
         donation_id: pending?.id ?? "",
         org_user_id: orgUserId,
       },
     });
 
     return jsonOk({ status: "checkout", url: session.url, donation_id: pending?.id });
   } catch (e) {
     console.error("create-donation-checkout error:", e);
     return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
   }
 });
 
 function jsonOk(body: unknown) {
   return new Response(JSON.stringify(body), {
     status: 200,
     headers: { ...corsHeaders, "Content-Type": "application/json" },
   });
 }
 function jsonErr(error: string, status = 400) {
   return new Response(JSON.stringify({ error }), {
     status,
     headers: { ...corsHeaders, "Content-Type": "application/json" },
   });
 }