import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Heart, Loader2, Trash2, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AgreementCard } from "@/components/AgreementCard";
import { MatingPaymentsCard } from "@/components/MatingPaymentsCard";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-foreground",
  accepted: "bg-primary-soft text-primary border-0",
  declined: "bg-destructive/10 text-destructive border-0",
  withdrawn: "bg-muted text-muted-foreground",
  agreed: "bg-primary text-primary-foreground border-0",
};

const MatesManage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: listings } = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("mating_listings")
        .select("*, pets:pet_id(name, avatar_url, breed)")
        .eq("owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: incoming } = useQuery({
    queryKey: ["requests-incoming", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("mating_requests")
        .select("*, from_pet:from_pet_id(name, breed, avatar_url), from_profile:from_owner_id(full_name, phone)")
        .eq("to_owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: outgoing } = useQuery({
    queryKey: ["requests-outgoing", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("mating_requests")
        .select("*, to_pet:to_pet_id(name, breed, avatar_url), to_profile:to_owner_id(full_name, phone)")
        .eq("from_owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "mating_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["requests-incoming"] });
        qc.invalidateQueries({ queryKey: ["requests-outgoing"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("mating_requests").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["requests-incoming"] });
    qc.invalidateQueries({ queryKey: ["requests-outgoing"] });
  };

  const deleteListing = async (id: string) => {
    const { error } = await supabase.from("mating_listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing removed");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };

  const boostListing = async (id: string) => {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    const { error } = await supabase
      .from("mating_listings")
      .update({ featured: true, boosted_until: until.toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing boosted for 7 days");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="font-display text-lg leading-tight">Mating</div>
          <div className="text-xs text-muted-foreground">Listings, requests, agreements</div>
        </div>
        <Button size="sm" onClick={() => nav("/mates/new")} className="rounded-full gap-1">
          <Heart className="h-3.5 w-3.5" /> New
        </Button>
      </header>

      <div className="container-app py-5">
        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-muted rounded-xl mb-5 h-11">
            <TabsTrigger value="incoming" className="rounded-lg text-xs">
              Incoming{incoming?.filter(r => r.status === "pending").length ? ` (${incoming.filter(r => r.status === "pending").length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="rounded-lg text-xs">Outgoing</TabsTrigger>
            <TabsTrigger value="listings" className="rounded-lg text-xs">My listings</TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="space-y-3">
            {!incoming?.length ? <Empty text="No incoming requests yet" /> : incoming.map((r: any) => (
              <RequestCard
                key={r.id}
                title={r.from_pet?.name}
                subtitle={r.from_pet?.breed}
                avatar={r.from_pet?.avatar_url}
                message={r.message}
                status={r.status}
                createdAt={r.created_at}
                actions={
                  r.status === "pending" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "declined")} className="gap-1 rounded-full border-hairline"><X className="h-3.5 w-3.5" /> Decline</Button>
                      <Button size="sm" onClick={() => updateStatus(r.id, "accepted")} className="gap-1 rounded-full"><Check className="h-3.5 w-3.5" /> Accept</Button>
                    </>
                  ) : null
                }
                agreement={["accepted", "agreed"].includes(r.status) ? (
                  <>
                    <AgreementCard requestId={r.id} isFromOwner={false} contactInfo={{ name: r.from_profile?.full_name, phone: r.from_profile?.phone }} />
                    <MatingPaymentsCard requestId={r.id} otherUserId={r.from_owner_id} />
                  </>
                ) : null}
              />
            ))}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-3">
            {!outgoing?.length ? <Empty text="No requests sent yet" /> : outgoing.map((r: any) => (
              <RequestCard
                key={r.id}
                title={r.to_pet?.name}
                subtitle={r.to_pet?.breed}
                avatar={r.to_pet?.avatar_url}
                message={r.message}
                status={r.status}
                createdAt={r.created_at}
                actions={
                  r.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "withdrawn")} className="rounded-full border-hairline">Withdraw</Button>
                  ) : null
                }
                agreement={["accepted", "agreed"].includes(r.status) ? (
                  <>
                    <AgreementCard requestId={r.id} isFromOwner={true} contactInfo={{ name: r.to_profile?.full_name, phone: r.to_profile?.phone }} />
                    <MatingPaymentsCard requestId={r.id} otherUserId={r.to_owner_id} />
                  </>
                ) : null}
              />
            ))}
          </TabsContent>

          <TabsContent value="listings" className="space-y-3">
            {!listings?.length ? <Empty text="No listings yet" cta={() => nav("/mates/new")} /> : listings.map((l: any) => (
              <Card key={l.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
                <div className="flex items-center gap-3">
                  {l.pets?.avatar_url ? (
                    <img src={l.pets.avatar_url} alt={l.pets.name} className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary grid place-items-center font-display">{l.pets?.name?.[0]}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{l.pets?.name}</div>
                      {l.featured && l.boosted_until && new Date(l.boosted_until) > new Date() && (
                        <Badge className="text-[9px] bg-primary text-primary-foreground border-0 gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Boosted
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{l.intent} · {l.fee_inr ? `₹${l.fee_inr}` : "Free"}{l.city ? ` · ${l.city}` : ""}</div>
                  </div>
                  {!(l.featured && l.boosted_until && new Date(l.boosted_until) > new Date()) && (
                    <Button variant="ghost" size="icon" onClick={() => boostListing(l.id)} className="rounded-full text-primary" title="Boost for 7 days">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => nav(`/mates/listing/${l.id}`)} className="rounded-full">
                    <Heart className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteListing(l.id)} className="rounded-full text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const RequestCard = ({ title, subtitle, avatar, message, status, createdAt, actions, agreement }: any) => (
  <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 space-y-3">
    <div className="flex items-start gap-3">
      {avatar ? (
        <img src={avatar} alt={title} className="h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary grid place-items-center font-display">{title?.[0]}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{title}</div>
          <Badge className={`capitalize text-[10px] ${STATUS_TONE[status] ?? ""}`}>{status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">{subtitle} · {format(new Date(createdAt), "d MMM")}</div>
        {message && <p className="text-sm mt-2 text-ink-soft">{message}</p>}
      </div>
    </div>
    {actions && <div className="flex justify-end gap-2">{actions}</div>}
    {agreement}
  </Card>
);

const Empty = ({ text, cta }: { text: string; cta?: () => void }) => (
  <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
    <Heart className="h-6 w-6 mx-auto text-primary mb-2" strokeWidth={1.5} />
    <div className="font-display text-lg">{text}</div>
    {cta && <Button onClick={cta} size="sm" className="mt-3 rounded-full">Create your first listing</Button>}
  </Card>
);

export default MatesManage;
