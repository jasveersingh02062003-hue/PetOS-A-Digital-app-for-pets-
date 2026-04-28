import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins, Clock, Gift, History, Sparkles } from "lucide-react";
import { format } from "date-fns";

type Account = {
  available_points: number;
  pending_points: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
};

type LedgerRow = {
  id: string;
  kind: string;
  points: number;
  reason: string;
  status: string;
  release_after: string | null;
  created_at: string;
};

type Redemption = {
  id: string;
  kind: string;
  points_spent: number;
  inr_value: number;
  status: string;
  created_at: string;
};

const REDEMPTION_OPTIONS = [
  { kind: "booking_discount" as const, label: "Booking Discount", points: 500, value: "₹50 off any service booking", icon: "🎟️" },
  { kind: "listing_boost" as const, label: "Listing Boost", points: 1000, value: "Boost a mating listing for 7 days", icon: "🚀" },
  { kind: "plus_credit" as const, label: "Plus Credit", points: 2000, value: "₹200 credit toward Plus subscription", icon: "⭐" },
];

export default function Rewards() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemOpen, setRedeemOpen] = useState<typeof REDEMPTION_OPTIONS[number] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: acc }, { data: led }, { data: red }] = await Promise.all([
      supabase.from("reward_accounts" as any).select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("reward_ledger" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("reward_redemptions" as any).select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setAccount((acc as any) || { available_points: 0, pending_points: 0, lifetime_earned: 0, lifetime_redeemed: 0 });
    setLedger((led as any) || []);
    setRedemptions((red as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleRedeem = async () => {
    if (!redeemOpen) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("redeem_reward" as any, {
      _kind: redeemOpen.kind,
      _points: redeemOpen.points,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Redemption requested! Our team will apply it shortly.");
    setRedeemOpen(null);
    load();
  };

  if (!user) return <div className="p-6">Please sign in to view rewards.</div>;

  const available = account?.available_points ?? 0;
  const pending = account?.pending_points ?? 0;

  return (
    <div className="container mx-auto max-w-3xl p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Rewards</h1>
      </div>

      <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Available balance</div>
            <div className="text-4xl font-bold flex items-center gap-2 mt-1">
              <Coins className="h-8 w-8 text-primary" />
              {available.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">≈ ₹{Math.floor(available / 10)}</div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
              <Clock className="h-3 w-3" /> Pending
            </div>
            <div className="text-xl font-semibold">{pending.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
          <div>Lifetime earned: <span className="font-medium text-foreground">{account?.lifetime_earned ?? 0}</span></div>
          <div>Lifetime redeemed: <span className="font-medium text-foreground">{account?.lifetime_redeemed ?? 0}</span></div>
        </div>
      </Card>

      <Tabs defaultValue="redeem" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="redeem"><Gift className="h-4 w-4 mr-1" />Redeem</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
          <TabsTrigger value="earn"><Sparkles className="h-4 w-4 mr-1" />Earn</TabsTrigger>
        </TabsList>

        <TabsContent value="redeem" className="space-y-2">
          {REDEMPTION_OPTIONS.map((opt) => {
            const canAfford = available >= opt.points;
            return (
              <Card key={opt.kind} className="p-4 flex items-center gap-3">
                <div className="text-3xl">{opt.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-sm text-muted-foreground">{opt.value}</div>
                  <div className="text-xs mt-1 font-medium text-primary">{opt.points.toLocaleString()} pts</div>
                </div>
                <Button size="sm" disabled={!canAfford} onClick={() => setRedeemOpen(opt)}>
                  {canAfford ? "Redeem" : "Locked"}
                </Button>
              </Card>
            );
          })}

          {redemptions.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Recent redemptions</h3>
              <div className="space-y-2">
                {redemptions.map((r) => (
                  <Card key={r.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{r.kind.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy")}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={r.status === "applied" ? "default" : "secondary"}>{r.status}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">-{r.points_spent} pts</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {loading && <div className="text-sm text-muted-foreground p-4">Loading…</div>}
          {!loading && ledger.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              No activity yet. Complete a booking or sign a mating agreement to start earning.
            </Card>
          )}
          {ledger.map((row) => (
            <Card key={row.id} className="p-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium">{row.reason}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{format(new Date(row.created_at), "dd MMM yyyy")}</span>
                  <Badge variant="outline" className="text-[10px] py-0">{row.status}</Badge>
                  {row.release_after && row.status === "pending" && (
                    <span>Releases {format(new Date(row.release_after), "dd MMM")}</span>
                  )}
                </div>
              </div>
              <div className={`text-sm font-semibold ${row.kind === "redeem" ? "text-destructive" : "text-primary"}`}>
                {row.kind === "redeem" ? "-" : "+"}{Math.abs(row.points)}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="earn" className="space-y-2">
          <EarnRow icon="✅" title="Complete a service booking" pts={50} note="Released after 7 days" />
          <EarnRow icon="📝" title="Sign a mating agreement" pts={200} note="Released after 14 days, both parties earn" />
          <EarnRow icon="🔥" title="7-day daily streak" pts={100} note="Instant" />
          <EarnRow icon="🏆" title="30-day daily streak" pts={500} note="Instant" />
          <EarnRow icon="💬" title="Helpful vet answer" pts={20} note="Per upvote" />
          <EarnRow icon="🎁" title="Refer a friend" pts={300} note="Released 30 days after they sign up" />
          <EarnRow icon="💉" title="Verify pet vaccinations" pts={100} note="Instant once approved" />
        </TabsContent>
      </Tabs>

      <Dialog open={!!redeemOpen} onOpenChange={(o) => !o && setRedeemOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm redemption</DialogTitle>
          </DialogHeader>
          {redeemOpen && (
            <div className="space-y-3">
              <div className="text-3xl text-center">{redeemOpen.icon}</div>
              <div className="text-center">
                <div className="font-semibold">{redeemOpen.label}</div>
                <div className="text-sm text-muted-foreground">{redeemOpen.value}</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-sm flex justify-between">
                <span>Cost</span>
                <span className="font-semibold">{redeemOpen.points.toLocaleString()} pts</span>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Your team will manually apply this within 24 hours.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemOpen(null)}>Cancel</Button>
            <Button onClick={handleRedeem} disabled={submitting}>
              {submitting ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EarnRow({ icon, title, pts, note }: { icon: string; title: string; pts: number; note: string }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
      <Badge variant="secondary">+{pts}</Badge>
    </Card>
  );
}