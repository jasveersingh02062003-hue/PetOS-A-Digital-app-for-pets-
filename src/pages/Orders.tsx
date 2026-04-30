import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShoppingBag, FileText, Calendar, Heart, Car, Truck, PackageCheck, Package as PackageIcon, Clock, Star } from "lucide-react";
import { EmptyState } from "@/components/empty/EmptyState";
import { RequestRefundButton } from "@/components/payments/RequestRefundButton";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LeaveReviewSheet } from "@/components/reviews/LeaveReviewSheet";

/**
 * Unified order & booking history.
 * Tabs: Shop · Bookings · Donations · Transport
 * Each list is independently fetched + lazy via tab-mount-on-demand.
 */
const Orders = () => {
  const nav = useNavigate();
  const { user } = useAuth();

  return (
    <div className="container-app pad-top-safe pb-24 max-w-2xl">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">My history</h1>
      </header>

      {!user ? (
        <EmptyState
          icon={ShoppingBag}
          title="Sign in to view your history"
          description="Your orders, bookings, and donations live here once you sign in."
          ctaLabel="Sign in"
          onCta={() => nav("/auth")}
        />
      ) : (
        <Tabs defaultValue="shop" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="shop" className="text-xs gap-1"><ShoppingBag className="h-3.5 w-3.5" /> Shop</TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs gap-1"><Calendar className="h-3.5 w-3.5" /> Bookings</TabsTrigger>
            <TabsTrigger value="donations" className="text-xs gap-1"><Heart className="h-3.5 w-3.5" /> Donations</TabsTrigger>
            <TabsTrigger value="transport" className="text-xs gap-1"><Car className="h-3.5 w-3.5" /> Transport</TabsTrigger>
          </TabsList>

          <TabsContent value="shop"><ShopOrdersTab userId={user.id} /></TabsContent>
          <TabsContent value="bookings"><BookingsTab userId={user.id} /></TabsContent>
          <TabsContent value="donations"><DonationsTab userId={user.id} /></TabsContent>
          <TabsContent value="transport"><TransportTab userId={user.id} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
};

const StatusPill = ({ status, paid }: { status: string; paid?: boolean }) => (
  <div className="flex items-center gap-1.5">
    {paid && <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5 font-medium">Paid</span>}
    <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">{status}</span>
  </div>
);

const SHIPMENT_STEPS = ["pending", "paid", "shipped", "delivered"] as const;
const ShipmentProgress = ({ status }: { status: string }) => {
  const idx = SHIPMENT_STEPS.indexOf(status as any);
  const active = idx < 0 ? 0 : idx;
  const labels: Record<string, { icon: any; label: string }> = {
    pending: { icon: Clock, label: "Placed" },
    paid: { icon: PackageIcon, label: "Confirmed" },
    shipped: { icon: Truck, label: "Shipped" },
    delivered: { icon: PackageCheck, label: "Delivered" },
  };
  if (status === "cancelled") {
    return <div className="text-xs text-destructive font-medium">Order cancelled</div>;
  }
  return (
    <div className="flex items-center gap-1">
      {SHIPMENT_STEPS.map((s, i) => {
        const Icon = labels[s].icon;
        const reached = i <= active;
        const isCurrent = i === active && status !== "delivered";
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className={`flex items-center w-full`}>
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : reached ? "bg-primary" : "bg-muted"}`} />
              <div
                className={`h-6 w-6 rounded-full grid place-items-center shrink-0 ${
                  reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                } ${isCurrent ? "ring-2 ring-primary/30 animate-pulse" : ""}`}
              >
                <Icon className="h-3 w-3" />
              </div>
              <div className={`h-0.5 flex-1 ${i === SHIPMENT_STEPS.length - 1 ? "opacity-0" : i < active ? "bg-primary" : "bg-muted"}`} />
            </div>
            <span className={`text-[10px] ${reached ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {labels[s].label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const formatEta = (etaIso: string | null, status: string) => {
  if (status === "delivered") return "Delivered";
  if (!etaIso) return null;
  const eta = new Date(etaIso);
  const days = Math.max(0, Math.ceil((eta.getTime() - Date.now()) / 86400_000));
  if (days === 0) return "Arriving today";
  if (days === 1) return "Arriving tomorrow";
  return `Arriving in ${days} days`;
};

const ShopOrdersTab = ({ userId }: { userId: string }) => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: react instantly to status / tracking changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`shop-orders-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shop_orders", filter: `customer_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as any;
          const prev = payload.old as any;
          if (next?.status && prev?.status && next.status !== prev.status) {
            if (next.status === "shipped") toast.success("📦 Your order has shipped!");
            else if (next.status === "delivered") toast.success("✅ Your order was delivered");
            else if (next.status === "cancelled") toast.error("Order cancelled");
          }
          qc.invalidateQueries({ queryKey: ["my-orders", userId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  if (isLoading) return <Skeleton />;
  if (!orders.length) return <EmptyState icon={ShoppingBag} title="No orders yet" description="Things you buy from the shop will appear here." ctaLabel="Browse shop" onCta={() => nav("/shop")} />;
  return (
    <div className="space-y-3">
      {orders.map((o: any) => (
        <Card key={o.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
            <StatusPill status={o.status} paid={!!o.payment_intent_id} />
          </div>
          <div className="text-sm space-y-1">
            {o.shop_order_items?.map((it: any) => (
              <div key={it.id} className="flex justify-between">
                <span className="truncate">{it.title_snapshot} × {it.qty}</span>
                <span>₹{it.unit_price_inr * it.qty}</span>
              </div>
            ))}
          </div>

          {/* Live shipment tracker */}
          <div className="mt-4 pt-3 border-t border-hairline">
            <ShipmentProgress status={o.status} />
            {(o.eta_at || o.tracking_number) && (
              <div className="mt-3 flex items-center justify-between text-xs gap-2 flex-wrap">
                {formatEta(o.eta_at, o.status) && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Truck className="h-3.5 w-3.5" />
                    {formatEta(o.eta_at, o.status)}
                  </span>
                )}
                {o.tracking_number && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-muted px-2 py-0.5 rounded">
                    {o.courier ? `${o.courier} · ` : ""}{o.tracking_number}
                  </span>
                )}
              </div>
            )}
            {o.pincode && (
              <div className="mt-1 text-[11px] text-muted-foreground">Delivering to {o.pincode}</div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-lg">₹{o.total_inr}</span>
          </div>
          {o.payment_intent_id && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-hairline">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to={`/receipt/${o.payment_intent_id}`}><FileText className="h-3.5 w-3.5 mr-1.5" /> Receipt</Link>
              </Button>
              <RequestRefundButton sourceKind="order" sourceId={o.id} amountInr={o.total_inr} />
            </div>
          )}
          {o.status === "delivered" && o.shop_order_items?.[0]?.product_id && (
            <ReviewItemsRow items={o.shop_order_items} />
          )}
        </Card>
      ))}
    </div>
  );
};

const ReviewItemsRow = ({ items }: { items: any[] }) => {
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null);
  const unique = Array.from(new Map(items.map((i) => [i.product_id, i])).values()).filter((i) => i.product_id);
  if (!unique.length) return null;
  return (
    <>
      <div className="mt-3 pt-3 border-t border-hairline">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">How was it?</div>
        <div className="flex flex-wrap gap-2">
          {unique.map((it) => (
            <Button
              key={it.product_id}
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setOpen({ id: it.product_id, title: it.title_snapshot })}
            >
              <Star className="h-3.5 w-3.5 mr-1.5" /> Rate {it.title_snapshot.slice(0, 24)}
            </Button>
          ))}
        </div>
      </div>
      {open && (
        <LeaveReviewSheet
          open={!!open}
          onOpenChange={(v) => !v && setOpen(null)}
          subjectType="product"
          subjectId={open.id}
          subjectName={open.title}
        />
      )}
    </>
  );
};

const BookingsTab = ({ userId }: { userId: string }) => {
  const nav = useNavigate();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("*, service_providers(name, category, cover_url)")
        .eq("customer_id", userId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Skeleton />;
  if (!bookings.length) return <EmptyState icon={Calendar} title="No bookings yet" description="Service bookings (grooming, walks, vet visits) will appear here." ctaLabel="Find services" onCta={() => nav("/services")} />;
  return (
    <div className="space-y-3">
      {bookings.map((b: any) => (
        <Card key={b.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium truncate">{b.service_providers?.name ?? "Provider"}</div>
            <StatusPill status={b.status} />
          </div>
          <div className="text-xs text-muted-foreground capitalize mb-2">{b.service_providers?.category}</div>
          <div className="text-sm">{new Date(b.scheduled_at).toLocaleString()}</div>
          {b.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{b.notes}</p>}
          {b.status === "completed" && b.provider_id && (
            <RateBookingButton providerId={b.provider_id} providerName={b.service_providers?.name} />
          )}
        </Card>
      ))}
    </div>
  );
};

const RateBookingButton = ({ providerId, providerName }: { providerId: string; providerName?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full mt-3" onClick={() => setOpen(true)}>
        <Star className="h-3.5 w-3.5 mr-1.5" /> Rate provider
      </Button>
      <LeaveReviewSheet
        open={open}
        onOpenChange={setOpen}
        subjectType="provider"
        subjectId={providerId}
        subjectName={providerName}
      />
    </>
  );
};

const DonationsTab = ({ userId }: { userId: string }) => {
  const nav = useNavigate();
  const { data: donations = [], isLoading } = useQuery({
    queryKey: ["my-donations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("donor_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Skeleton />;
  if (!donations.length) return <EmptyState icon={Heart} title="No donations yet" description="Your contributions to shelters and rescuers will appear here." ctaLabel="Find shelters" onCta={() => nav("/shelters")} />;
  return (
    <div className="space-y-3">
      {donations.map((d: any) => (
        <Card key={d.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
            <StatusPill status={d.status} paid={d.status === "paid"} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Donation</span>
            <span className="font-display text-lg text-coral">₹{d.amount_inr.toLocaleString("en-IN")}</span>
          </div>
          {d.tax_receipt_number && (
            <Button asChild size="sm" variant="outline" className="w-full mt-3">
              <Link to={`/donations/${d.id}/receipt`}><FileText className="h-3.5 w-3.5 mr-1.5" /> 80G Receipt</Link>
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
};

const TransportTab = ({ userId }: { userId: string }) => {
  const nav = useNavigate();
  const { data: rides = [], isLoading } = useQuery({
    queryKey: ["my-transport", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_bookings")
        .select("*")
        .eq("customer_id", userId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Skeleton />;
  if (!rides.length) return <EmptyState icon={Car} title="No rides yet" description="Pet-taxi rides you book will appear here." ctaLabel="Book a ride" onCta={() => nav("/taxi")} />;
  return (
    <div className="space-y-3">
      {rides.map((r: any) => (
        <Card key={r.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{new Date(r.scheduled_at).toLocaleString()}</span>
            <StatusPill status={r.status} />
          </div>
          <div className="text-sm space-y-0.5">
            <div className="truncate"><span className="text-muted-foreground">From:</span> {r.pickup_address}</div>
            <div className="truncate"><span className="text-muted-foreground">To:</span> {r.dropoff_address}</div>
          </div>
          {r.fare_inr && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-hairline">
              <span className="text-sm text-muted-foreground">Fare</span>
              <span className="font-display">₹{r.fare_inr}</span>
            </div>
          )}
          <Button asChild size="sm" variant="outline" className="w-full mt-3">
            <Link to={`/taxi/${r.id}`}>View ride</Link>
          </Button>
        </Card>
      ))}
    </div>
  );
};

const Skeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />)}
  </div>
);

export default Orders;
