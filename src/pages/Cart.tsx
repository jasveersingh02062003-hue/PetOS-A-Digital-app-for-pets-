import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Cart = () => {
  const nav = useNavigate();
  const { items, setQty, remove, total, clear } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const checkout = async () => {
    if (!user) return toast.error("Please sign in first");
    if (!items.length) return;
    if (!address) return toast.error("Add a shipping address");
    setPlacing(true);

    const { data: order, error } = await supabase
      .from("shop_orders")
      .insert({
        customer_id: user.id,
        total_inr: total,
        shipping_address: address,
        contact_phone: phone || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error || !order) {
      setPlacing(false);
      return toast.error(error?.message || "Failed to create order");
    }

    const { error: itemsErr } = await supabase.from("shop_order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        seller_id: i.seller_id,
        qty: i.qty,
        unit_price_inr: i.price_inr,
        title_snapshot: i.title,
      })),
    );

    setPlacing(false);
    if (itemsErr) return toast.error(itemsErr.message);

    toast.success("Order placed! Sellers will be notified.");
    clear();
    nav("/orders");
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">Cart</h1>
      </header>

      {items.length === 0 ? (
        <Card className="rounded-2xl border-hairline p-8 text-center">
          <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">Your cart is empty</p>
          <Button className="mt-4 rounded-full" onClick={() => nav("/shop")}>
            Browse shop
          </Button>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((i) => (
              <Card key={i.product_id} className="rounded-2xl border-hairline p-3 flex gap-3 items-center">
                <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                  {i.image_url && (
                    <img src={i.image_url} alt={i.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-2">{i.title}</div>
                  <div className="text-sm font-display mt-0.5">₹{i.price_inr}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => setQty(i.product_id, i.qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm w-6 text-center">{i.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => setQty(i.product_id, i.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={() => remove(i.product_id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-3 mt-6">
            <div className="space-y-1.5">
              <Label>Shipping address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <Card className="rounded-2xl border-hairline p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl">₹{total}</span>
            </div>
            <Button onClick={checkout} disabled={placing} className="w-full rounded-full h-12">
              {placing ? "Placing…" : "Place order"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Payment & SMS confirmation will be wired in later.
            </p>
          </Card>
        </>
      )}
    </div>
  );
};

export default Cart;
