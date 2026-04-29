import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Users, Search, Video, MessageSquare, MapPin, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { EarningsCard } from "@/components/payments/EarningsCard";

const modeIcon: Record<string, JSX.Element> = {
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  in_clinic: <MapPin className="h-3.5 w-3.5" />,
};

const VetDashboard = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [lookup, setLookup] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);

  const { data: isVet, isLoading: roleLoading } = useQuery({
    queryKey: ["is-vet-d", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["vet", "super_admin"]);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const { data: today } = useQuery({
    queryKey: ["vet-today", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments" as any)
        .select("*, pets(name, species, breed, avatar_url)")
        .eq("vet_id", user!.id)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!isVet,
  });

  const { data: schedule } = useQuery({
    queryKey: ["vet-schedule", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments" as any)
        .select("*, pets(name, species, breed)")
        .eq("vet_id", user!.id)
        .gte("scheduled_at", new Date().toISOString())
        .in("status", ["requested", "confirmed", "in_progress"])
        .order("scheduled_at")
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!isVet,
  });

  const { data: patients } = useQuery({
    queryKey: ["vet-patients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_care_team" as any)
        .select("pet_id, granted_at, pets(id, name, species, breed, avatar_url, public_id, owner_id)")
        .eq("vet_id", user!.id)
        .is("revoked_at", null)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!isVet,
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ["vet-my-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_access_requests" as any)
        .select("*")
        .eq("vet_id", user!.id)
        .eq("status", "pending");
      return (data ?? []) as any[];
    },
    enabled: !!isVet,
  });

  const updateAppt = async (id: string, status: string) => {
    const { error } = await supabase
      .from("appointments" as any)
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
  };

  const doLookup = async () => {
    const code = lookup.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase
      .from("pets")
      .select("id, name, species, breed, avatar_url, public_id, owner_id")
      .eq("public_id", code)
      .maybeSingle();
    if (!data) {
      setLookupResult(null);
      return toast.error("No pet found with that ID");
    }
    setLookupResult(data);
  };

  const requestAccess = async (pet: any) => {
    if (!user) return;
    const { error } = await supabase.from("pet_access_requests" as any).insert({
      pet_id: pet.id,
      owner_id: pet.owner_id,
      vet_id: user.id,
      message: "Requesting persistent access to this pet's records.",
    });
    if (error) return toast.error(error.message);
    toast.success("Access request sent to owner");
  };

  if (roleLoading) return <div className="container-app pad-top-safe pt-6">Loading…</div>;

  if (!isVet) {
    return (
      <div className="container-app pad-top-safe pt-6 space-y-4">
        <header className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl">Vet portal</h1>
        </header>
        <Card className="rounded-2xl border-hairline p-6 text-center space-y-3">
          <Stethoscope className="h-10 w-10 mx-auto text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">You don't have vet access yet.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => nav("/vet/apply")} className="rounded-full">Apply as a vet</Button>
            <Button variant="outline" onClick={() => nav("/vet/onboarding")} className="rounded-full">
              Set up vet profile
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">Vet portal</h1>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => nav("/vet/onboarding")}>
          Profile
        </Button>
      </header>

      <Tabs defaultValue="today">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="lookup">Lookup</TabsTrigger>
          <TabsTrigger value="earnings">$</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3 pt-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {today?.length ?? 0} appointments today
          </div>
          {(today?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled today.
            </Card>
          )}
          {today?.map((a) => (
            <ApptCard key={a.id} a={a} onUpdate={updateAppt} />
          ))}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-3 pt-4">
          {(schedule?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              No upcoming appointments.
            </Card>
          )}
          {schedule?.map((a) => (
            <ApptCard key={a.id} a={a} onUpdate={updateAppt} />
          ))}
        </TabsContent>

        <TabsContent value="patients" className="space-y-3 pt-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {patients?.length ?? 0} active patients
          </div>
          {(patients?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              No patients yet. Owners can add you via Pet ID.
            </Card>
          )}
          {patients?.map((p: any) => (
            <Card key={p.pet_id} className="rounded-2xl border-hairline p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
                {p.pets?.avatar_url ? (
                  <img src={p.pets.avatar_url} alt={p.pets.name} className="h-full w-full object-cover" />
                ) : (
                  <Stethoscope className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base">{p.pets?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.pets?.species} · {p.pets?.public_id}
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to={`/health/${p.pet_id}/timeline`}>Open</Link>
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="lookup" className="space-y-3 pt-4">
          <Card className="rounded-2xl border-hairline p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="PET-XXXXX"
                className="uppercase"
                onKeyDown={(e) => e.key === "Enter" && doLookup()}
              />
              <Button size="sm" className="rounded-full" onClick={doLookup}>Find</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a pet's permanent Pet ID. Owners can show it from their pet profile.
            </p>
          </Card>

          {lookupResult && (
            <Card className="rounded-2xl border-hairline p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
                {lookupResult.avatar_url ? (
                  <img src={lookupResult.avatar_url} alt={lookupResult.name} className="h-full w-full object-cover" />
                ) : (
                  <Stethoscope className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base">{lookupResult.name}</div>
                <div className="text-xs text-muted-foreground">
                  {lookupResult.species} · {lookupResult.public_id}
                </div>
              </div>
              <Button size="sm" className="rounded-full" onClick={() => requestAccess(lookupResult)}>
                Request access
              </Button>
            </Card>
          )}

          {(pendingRequests?.length ?? 0) > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs text-muted-foreground">Your pending requests</div>
              {pendingRequests!.map((r) => (
                <Card key={r.id} className="rounded-2xl border-hairline p-3 text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Pet {r.pet_id.slice(0, 8)}…</span>
                  <span className="text-xs rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-1 capitalize">
                    {r.status}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ApptCard = ({ a, onUpdate }: { a: any; onUpdate: (id: string, s: string) => void }) => {
  const t = new Date(a.scheduled_at);
  return (
    <Card className="rounded-2xl border-hairline p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-display text-base">{a.pets?.name || "Pet"}</div>
          <div className="text-xs text-muted-foreground">
            {a.pets?.species} · {a.pets?.breed || "—"}
          </div>
          <div className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
            {modeIcon[a.mode]}
            <span className="capitalize">{a.mode.replace("_", " ")}</span>
            <span>·</span>
            <span>{t.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        </div>
        <span className="text-[10px] rounded-full bg-muted px-2 py-1 capitalize">{a.status.replace("_", " ")}</span>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
        {a.status === "requested" && (
          <>
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => onUpdate(a.id, "cancelled")}>
              Decline
            </Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={() => onUpdate(a.id, "confirmed")}>
              Confirm
            </Button>
          </>
        )}
        {a.status === "confirmed" && (
          <Button size="sm" className="flex-1 rounded-full" onClick={() => onUpdate(a.id, "in_progress")}>
            Start
          </Button>
        )}
        {a.status === "in_progress" && (
          <Button size="sm" className="flex-1 rounded-full" onClick={() => onUpdate(a.id, "completed")}>
            Complete
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to={`/appointment/${a.id}`}>Open</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to={`/health/${a.pet_id}/timeline`}>Records</Link>
        </Button>
      </div>
    </Card>
  );
};

export default VetDashboard;
