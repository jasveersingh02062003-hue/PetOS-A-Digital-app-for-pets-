import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type DemoUser = {
  email: string;
  password: string;
  full_name: string;
  account_type:
    | "pet_parent"
    | "buyer"
    | "breeder"
    | "kennel"
    | "shelter"
    | "sanctuary"
    | "zoo"
    | "rescuer";
  city: string;
  handle: string;
  is_org?: boolean;
  org_name?: string;
  org_status?: "pending" | "approved";
  is_vet?: boolean;
  is_walker?: boolean;
  is_taxi?: boolean;
  is_admin?: boolean;
  monthly_upkeep_inr?: number;
};

const DEMO: DemoUser[] = [
  { email: "demo.parent@petos.test", password: "DemoPass!2026", full_name: "Aarti Parent", account_type: "pet_parent", city: "Hyderabad", handle: "aarti_parent" },
  { email: "demo.buyer@petos.test", password: "DemoPass!2026", full_name: "Bhavna Buyer", account_type: "buyer", city: "Bengaluru", handle: "bhavna_buyer" },
  { email: "demo.breeder@petos.test", password: "DemoPass!2026", full_name: "Charan Breeder", account_type: "breeder", city: "Pune", handle: "charan_kennels", is_org: true, org_name: "Charan Champion Kennels", org_status: "approved" },
  { email: "demo.kennel@petos.test", password: "DemoPass!2026", full_name: "Devi Boarding", account_type: "kennel", city: "Mumbai", handle: "devi_boarding", is_org: true, org_name: "Devi Pet Boarding", org_status: "approved" },
  { email: "demo.shelter@petos.test", password: "DemoPass!2026", full_name: "Esha Shelter", account_type: "shelter", city: "Delhi", handle: "esha_rescue", is_org: true, org_name: "Esha Animal Rescue", org_status: "approved" },
  { email: "demo.sanctuary@petos.test", password: "DemoPass!2026", full_name: "Falgun Sanctuary", account_type: "sanctuary", city: "Vrindavan", handle: "falgun_gaushala", is_org: true, org_name: "Falgun Gaushala", org_status: "approved", monthly_upkeep_inr: 250000 },
  { email: "demo.zoo@petos.test", password: "DemoPass!2026", full_name: "Garuda Wildlife", account_type: "zoo", city: "Mysuru", handle: "garuda_zoo", is_org: true, org_name: "Garuda Wildlife Park", org_status: "approved" },
  { email: "demo.rescuer1@petos.test", password: "DemoPass!2026", full_name: "Hema Rescuer", account_type: "rescuer", city: "Chennai", handle: "hema_rescues", is_org: true, org_name: "Hema Street Rescue", org_status: "pending" },
  { email: "demo.rescuer2@petos.test", password: "DemoPass!2026", full_name: "Iqbal Rescuer", account_type: "rescuer", city: "Kolkata", handle: "iqbal_rescues", is_org: true, org_name: "Iqbal Animal Aid", org_status: "approved" },
  { email: "demo.vet@petos.test", password: "DemoPass!2026", full_name: "Dr. Jaya Vet", account_type: "pet_parent", city: "Hyderabad", handle: "dr_jaya", is_vet: true },
  { email: "demo.walker@petos.test", password: "DemoPass!2026", full_name: "Kiran Walker", account_type: "pet_parent", city: "Bengaluru", handle: "kiran_walks", is_walker: true },
  { email: "demo.taxi@petos.test", password: "DemoPass!2026", full_name: "Lalit Pet Taxi", account_type: "pet_parent", city: "Mumbai", handle: "lalit_taxi", is_taxi: true },
  { email: "demo.admin@petos.test", password: "DemoPass!2026", full_name: "Mohan Admin", account_type: "pet_parent", city: "Hyderabad", handle: "mohan_admin", is_admin: true },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const log: string[] = [];
    const ids: Record<string, string> = {};

    // 1. Create or fetch demo users
    for (const u of DEMO) {
      // Try to find existing user by email
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = existing?.users?.find((x) => x.email === u.email);
      let userId: string;
      if (found) {
        userId = found.id;
        log.push(`reuse ${u.email} -> ${userId}`);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (error || !data.user) {
          log.push(`FAIL create ${u.email}: ${error?.message}`);
          continue;
        }
        userId = data.user.id;
        log.push(`created ${u.email} -> ${userId}`);
      }
      ids[u.handle] = userId;

      // Upsert profile
      await admin.from("profiles").upsert({
        id: userId,
        full_name: u.full_name,
        account_type: u.account_type,
        city: u.city,
        handle: u.handle,
        onboarded: true,
        bio: `Demo ${u.account_type} account.`,
      });

      // Org profile
      if (u.is_org) {
        await admin.from("org_profiles").upsert({
          user_id: userId,
          org_name: u.org_name!,
          org_type: u.account_type,
          city: u.city,
          status: u.org_status ?? "pending",
          description: `${u.org_name} — demo organization.`,
          phone: "+91 90000 00000",
          ...(u.monthly_upkeep_inr ? { donation_url: "https://example.com/donate" } : {}),
        });
      }

      // Roles
      const roles: string[] = [];
      if (u.is_admin) roles.push("super_admin");
      if (u.is_vet) roles.push("vet");
      if (u.account_type === "shelter" || u.account_type === "sanctuary") roles.push("ngo");
      if (u.is_walker || u.is_taxi || u.account_type === "kennel") roles.push("boarding_provider");
      for (const r of roles) {
        await admin.from("user_roles").upsert({ user_id: userId, role: r });
      }

      // Vet profile
      if (u.is_vet) {
        await admin.from("vet_profiles").upsert({
          user_id: userId,
          full_name: u.full_name,
          city: u.city,
          license_number: "VET-DEMO-001",
          license_state: "TS",
          status: "approved",
          specializations: ["general", "dermatology"],
          consultation_fee_inr: 500,
        } as any);
      }
    }

    // 2. Pets
    const petIds: Record<string, string> = {};
    const pets = [
      { owner: "aarti_parent", name: "Mochi", species: "dog", breed: "Labrador", gender: "female", dob: "2022-03-15", city: "Hyderabad" },
      { owner: "aarti_parent", name: "Pixel", species: "cat", breed: "Persian", gender: "male", dob: "2023-01-10", city: "Hyderabad" },
      { owner: "charan_kennels", name: "Thor", species: "dog", breed: "German Shepherd", gender: "male", dob: "2020-05-01", city: "Pune", studable: true },
      { owner: "charan_kennels", name: "Luna", species: "dog", breed: "German Shepherd", gender: "female", dob: "2020-07-12", city: "Pune", studable: true },
      { owner: "esha_rescue", name: "Brownie", species: "dog", breed: "Indie", gender: "male", dob: "2024-02-01", city: "Delhi" },
      { owner: "esha_rescue", name: "Mittens", species: "cat", breed: "Indie", gender: "female", dob: "2024-04-10", city: "Delhi" },
      { owner: "falgun_gaushala", name: "Gauri", species: "other", breed: "Cow", gender: "female", dob: "2019-08-20", city: "Vrindavan" },
      { owner: "garuda_zoo", name: "Raja", species: "other", breed: "Bengal Tiger", gender: "male", dob: "2018-11-11", city: "Mysuru" },
    ];
    for (const p of pets) {
      const owner = ids[p.owner];
      if (!owner) continue;
      const { data } = await admin.from("pets").insert({
        owner_id: owner,
        name: p.name,
        species: p.species as any,
        breed: p.breed,
        gender: p.gender as any,
        date_of_birth: p.dob,
        city: p.city,
        bio: `${p.name} is a demo pet.`,
        vaccination_verified: true,
        discoverable_for_mating: !!(p as any).studable,
        status_chip: (p as any).studable ? "available_for_stud" : null,
      }).select("id").single();
      if (data) petIds[p.name] = data.id;
    }
    // Litter linkage: a "Bred on PetOS" puppy from Thor + Luna
    if (petIds["Thor"] && petIds["Luna"]) {
      const { data } = await admin.from("pets").insert({
        owner_id: ids["charan_kennels"],
        name: "Storm",
        species: "dog" as any,
        breed: "German Shepherd",
        gender: "male" as any,
        date_of_birth: "2025-06-01",
        city: "Pune",
        bio: "Bred on PetOS.",
        vaccination_verified: true,
        sire_pet_id: petIds["Thor"],
        dam_pet_id: petIds["Luna"],
      }).select("id").single();
      if (data) petIds["Storm"] = data.id;
    }

    // 3. Pet listings
    if (petIds["Storm"]) {
      await admin.from("pet_listings").insert({
        owner_id: ids["charan_kennels"],
        pet_id: petIds["Storm"],
        listing_type: "breeder_sale" as any,
        fee_inr: 45000,
        title: "Storm — KCI registered GSD pup",
        description: "Bred on PetOS. Hips OFA Good. Both parents on platform.",
        species: "dog",
        breed: "German Shepherd",
        gender: "male",
        age_weeks: 12,
        city: "Pune",
        vaccination_doc_url: "https://example.com/vacc.pdf",
        breeder_cert_url: "https://example.com/cert.pdf",
      });
    }
    if (petIds["Brownie"]) {
      await admin.from("pet_listings").insert({
        owner_id: ids["esha_rescue"],
        pet_id: petIds["Brownie"],
        listing_type: "adoption" as any,
        fee_inr: 0,
        title: "Brownie needs a forever home",
        description: "Friendly indie boy, vaccinated, sterilized.",
        species: "dog",
        breed: "Indie",
        gender: "male",
        age_weeks: 60,
        city: "Delhi",
        vaccination_doc_url: "https://example.com/vacc.pdf",
      });
    }

    // 4. Boarding services
    if (ids["devi_boarding"]) {
      await admin.from("boarding_services").insert([
        { owner_id: ids["devi_boarding"], title: "Devi 5-star Dog Boarding", service_type: "boarding", price_inr_per_day: 800, city: "Mumbai", capacity: 12, description: "AC suites, 3 walks/day, daily reports." },
        { owner_id: ids["devi_boarding"], title: "Cat-only Boarding", service_type: "boarding", price_inr_per_day: 600, city: "Mumbai", capacity: 8 },
      ]);
    }
    if (ids["kiran_walks"]) {
      await admin.from("boarding_services").insert({ owner_id: ids["kiran_walks"], title: "Kiran Daily Walks", service_type: "walker", price_inr_per_day: 300, city: "Bengaluru" });
    }
    if (ids["lalit_taxi"]) {
      await admin.from("boarding_services").insert({ owner_id: ids["lalit_taxi"], title: "Lalit Pet Taxi", service_type: "transport", price_inr_per_day: 500, city: "Mumbai" });
    }

    // 5. Posts (one per main user)
    const postSeeds = [
      { author: "aarti_parent", pet: "Mochi", caption: "Beach day with Mochi! 🐾", img: "https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800" },
      { author: "charan_kennels", pet: "Storm", caption: "Storm — bred on PetOS. Both parents on the platform.", img: "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=800" },
      { author: "esha_rescue", pet: "Brownie", caption: "Day 1 of Brownie's rescue journey 🧡", img: "https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800" },
      { author: "garuda_zoo", pet: "Raja", caption: "Meet Raja — symbolic adoption supports his care.", img: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=800" },
    ];
    for (const p of postSeeds) {
      if (!ids[p.author] || !petIds[p.pet]) continue;
      await admin.from("posts").insert({
        author_id: ids[p.author],
        pet_id: petIds[p.pet],
        caption: p.caption,
        image_url: p.img,
      });
    }

    // 6. Rescue journey
    if (ids["esha_rescue"] && petIds["Brownie"]) {
      const { data: rj, error: rjErr } = await admin.from("rescue_journeys").insert({
        org_id: ids["esha_rescue"],
        pet_id: petIds["Brownie"],
        title: "Brownie's Rescue Journey",
        status: "in_care",
      }).select("id").single();
      if (rjErr) log.push(`FAIL rescue_journey: ${rjErr.message}`);
      if (rj) {
        const { error: rjeErr } = await admin.from("rescue_journey_entries").insert([
          { journey_id: rj.id, day_number: 1, caption: "Found on the street, scared and hungry." },
          { journey_id: rj.id, day_number: 7, caption: "First vet visit, vaccinations started." },
          { journey_id: rj.id, day_number: 30, caption: "Healthy, playful, ready for a home." },
          { journey_id: rj.id, day_number: 45, caption: "Listed for adoption!" },
        ]);
        if (rjeErr) log.push(`FAIL rescue_journey_entries: ${rjeErr.message}`);
      }
    }

    // 7. Appointment + service booking + kennel daily report
    if (ids["dr_jaya"] && ids["aarti_parent"] && petIds["Mochi"]) {
      await admin.from("appointments").insert({
        vet_id: ids["dr_jaya"],
        owner_id: ids["aarti_parent"],
        pet_id: petIds["Mochi"],
        mode: "video" as any,
        status: "completed" as any,
        scheduled_at: new Date(Date.now() - 86400000).toISOString(),
        notes: "Routine wellness check. All good.",
      });
    }
    if (ids["devi_boarding"] && ids["aarti_parent"] && petIds["Mochi"]) {
      const { data: bk, error: bkErr } = await admin.from("service_bookings").insert({
        provider_id: ids["devi_boarding"],
        customer_id: ids["aarti_parent"],
        pet_id: petIds["Mochi"],
        scheduled_at: new Date().toISOString(),
        status: "confirmed" as any,
        notes: "3-night stay",
      }).select("id").single();
      if (bkErr) log.push(`FAIL service_booking: ${bkErr.message}`);
      if (bk) {
        const { error: krErr } = await admin.from("kennel_daily_reports").insert({
          booking_id: bk.id,
          provider_id: ids["devi_boarding"],
          author_id: ids["devi_boarding"],
          meals: 2,
          walks: 3,
          potty: 4,
          mood: "happy",
          notes: "Mochi loved the morning walk and made a new friend!",
        });
        if (krErr) log.push(`FAIL kennel_daily_report: ${krErr.message}`);
      }
    }

    // 8. Donation
    if (ids["aarti_parent"] && ids["esha_rescue"]) {
      await admin.from("donations").insert({
        donor_id: ids["aarti_parent"],
        org_user_id: ids["esha_rescue"],
        amount_inr: 1000,
        message: "Keep up the great rescue work!",
        status: "paid" as any,
        paid_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, ids, log }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});