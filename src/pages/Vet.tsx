import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const severityColor = {
  mild: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  moderate: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  severe: "bg-red-500/15 text-red-700 dark:text-red-300",
} as const;

const Vet = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isVet, isLoading: roleLoading } = useQuery({
    queryKey: ["is-vet", user?.id],
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

  const { data: consults } = useQuery({
    queryKey: ["vet-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_consults")
        .select("*, pets(name, species, breed)")
        .in("status", ["awaiting_vet", "assigned", "in_progress"])
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isVet,
  });

  const { data: verifications } = useQuery({
    queryKey: ["verification-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("*, pets(name, species, breed, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!isVet,
  });

  const claim = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("vet_consults")
      .update({ vet_id: user.id, status: "assigned" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Consult claimed");
    qc.invalidateQueries({ queryKey: ["vet-queue"] });
    nav(`/vet/consult/${id}`);
  };

  const reviewVerification = async (id: string, status: "approved" | "rejected", notes?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("verification_requests")
      .update({ status, reviewer_id: user.id, reviewer_notes: notes || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Pet verified" : "Request rejected");
    qc.invalidateQueries({ queryKey: ["verification-queue"] });
  };

  if (roleLoading) {
    return <div className="container-app pad-top-safe pt-6">Loading…</div>;
  }
  if (!isVet) {
    return (
      <div className="container-app pad-top-safe pt-6 space-y-4">
        <header className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl">Vet portal</h1>
        </header>
        <Card className="rounded-2xl border-hairline p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            You don't have vet access yet.
          </p>
          <Button onClick={() => nav("/vet/apply")} className="rounded-full">
            Apply to join
          </Button>
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
      </header>

      <Tabs defaultValue="consults">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="consults">
            Consults {consults?.length ? `(${consults.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="verify">
            Verifications {verifications?.length ? `(${verifications.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consults" className="space-y-3 pt-4">
          {(consults?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              No consults in queue.
            </Card>
          )}
          {consults?.map((c: any) => (
            <Card key={c.id} className="rounded-2xl border-hairline p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-base">{c.pets?.name || "Pet"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.pets?.species} · {c.pets?.breed || "—"}
                  </div>
                </div>
                <span className={`text-[10px] rounded-full px-2 py-1 capitalize font-medium ${severityColor[c.severity as keyof typeof severityColor]}`}>
                  {c.severity === "severe" && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                  {c.severity}
                </span>
              </div>
              {c.ai_summary && (
                <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">
                  {c.ai_summary}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">
                  {c.status.replace("_", " ")}
                </span>
                {c.status === "awaiting_vet" ? (
                  <Button size="sm" className="rounded-full" onClick={() => claim(c.id)}>
                    Claim
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to={`/vet/consult/${c.id}`}>Open</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="verify" className="space-y-3 pt-4">
          {(verifications?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              No verification requests pending.
            </Card>
          )}
          {verifications?.map((v: any) => (
            <Card key={v.id} className="rounded-2xl border-hairline p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
                  {v.pets?.avatar_url ? (
                    <img src={v.pets.avatar_url} alt={v.pets.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base">{v.pets?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.pets?.species} · {v.pets?.breed || "—"}
                  </div>
                </div>
              </div>
              {v.notes && (
                <p className="text-sm mt-3 text-muted-foreground">{v.notes}</p>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => reviewVerification(v.id, "rejected")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={() => reviewVerification(v.id, "approved")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Vet;
