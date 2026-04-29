import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";
import { TrustBadge } from "@/components/services/TrustBadge";
import { EarningsCard } from "@/components/payments/EarningsCard";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const ServicesManage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: listings } = useQuery({
    queryKey: ["my-providers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: incoming } = useQuery({
    queryKey: ["bookings-incoming", user?.id],
    queryFn: async () => {
      const ids = (listings ?? []).map((l) => l.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("service_bookings")
        .select("*, service_providers(name)")
        .in("provider_id", ids)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!listings,
  });

  const { data: outgoing } = useQuery({
    queryKey: ["bookings-outgoing", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("*, service_providers(name)")
        .eq("customer_id", user!.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await supabase
      .from("service_bookings")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["bookings-incoming"] });
    qc.invalidateQueries({ queryKey: ["bookings-outgoing"] });
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Manage</h1>
        <div className="ml-auto">
          <Button asChild size="sm" className="rounded-full">
            <Link to="/services/new">
              <Plus className="h-4 w-4 mr-1" /> New
            </Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="incoming">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          <TabsTrigger value="outgoing">My bookings</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-3 pt-4">
          {(incoming?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          )}
          {incoming?.map((b: any) => (
            <Card key={b.id} className="rounded-2xl border-hairline p-4">
              <div className="text-sm font-medium">{b.service_providers?.name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(b.scheduled_at).toLocaleString()}
              </div>
              {b.notes && <p className="text-sm mt-2">{b.notes}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">
                  {b.status}
                </span>
                {b.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "declined")}>
                      Decline
                    </Button>
                    <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")}>
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-3 pt-4">
          {(outgoing?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          )}
          {outgoing?.map((b: any) => (
            <Card key={b.id} className="rounded-2xl border-hairline p-4">
              <div className="text-sm font-medium">{b.service_providers?.name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(b.scheduled_at).toLocaleString()}
              </div>
              <div className="mt-2">
                <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">
                  {b.status}
                </span>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="listings" className="space-y-3 pt-4">
          {(listings?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No listings yet.</p>
          )}
          {listings?.map((l) => (
            <Card key={l.id} className="rounded-2xl border-hairline p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-base truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {l.category} · {l.city || "—"}
                  </div>
                </div>
                <TrustBadge provider={l as any} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-hairline gap-1.5"
                onClick={() => nav(`/services/trust/${l.id}`)}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Build trust
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="earnings" className="space-y-3 pt-4">
          <EarningsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServicesManage;
