import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Bell, Pause, Play, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const ShopReminders = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["shop-reminders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_reminders")
        .select("id, cadence_days, next_run_on, last_notified_on, active, product_id, shop_products(title, image_url, price_inr)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("shop_reminders").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["shop-reminders"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    await supabase.from("shop_reminders").delete().eq("id", id);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["shop-reminders"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Reorder reminders</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-3">
        {isLoading && <Card className="rounded-2xl border-hairline p-6 text-sm text-muted-foreground">Loading…</Card>}

        {!isLoading && (reminders?.length ?? 0) === 0 && (
          <Card className="rounded-2xl border-hairline p-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="font-medium">No reminders yet</div>
            <p className="text-sm text-muted-foreground mt-1">
              Tap the bell on any shop product to be reminded before you run out.
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/shop"><ShoppingBag className="h-4 w-4 mr-1.5" /> Browse shop</Link>
            </Button>
          </Card>
        )}

        {reminders?.map((r: any) => {
          const p = r.shop_products;
          return (
            <Card key={r.id} className="rounded-2xl border-hairline p-3 flex gap-3 items-center">
              <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {p?.image_url
                  ? <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                  : <ShoppingBag className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p?.title ?? "Product"}</div>
                <div className="text-xs text-muted-foreground">
                  Every {r.cadence_days}d · next {new Date(r.next_run_on).toLocaleDateString()}
                  {!r.active && " · paused"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggle(r.id, r.active)} aria-label={r.active ? "Pause" : "Resume"}>
                {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          );
        })}
      </main>
    </div>
  );
};

export default ShopReminders;
