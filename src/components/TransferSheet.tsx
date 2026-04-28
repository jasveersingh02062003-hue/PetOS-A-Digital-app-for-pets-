import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRightLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type Listing = {
  id: string;
  owner_id: string;
  pet_id: string | null;
  fee_inr: number | null;
  title: string;
};

/**
 * Shown to the SELLER on their own listing.
 * Lets them initiate a transfer to a buyer (looked up by email).
 */
export function StartTransferSheet({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [buyerEmail, setBuyerEmail] = useState("");
  const [price, setPrice] = useState(listing.fee_inr?.toString() ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!listing.pet_id) {
      toast.error("This listing has no linked pet on PetOS — cannot transfer.");
      return;
    }
    if (!buyerEmail.trim()) return toast.error("Buyer email required");
    setSaving(true);
    try {
      // Look up buyer profile by email
      const { data: u, error: uerr } = await supabase
        .rpc("get_user_id_by_email" as any, { _email: buyerEmail.trim().toLowerCase() })
        .maybeSingle();
      if (uerr || !u) {
        toast.error("Buyer not found. Ask them to sign up on PetOS first.");
        setSaving(false);
        return;
      }
      const toUserId = (u as any).user_id ?? u;
      const { error } = await supabase.from("ownership_transfers").insert({
        listing_id: listing.id,
        pet_id: listing.pet_id,
        from_user_id: user.id,
        to_user_id: toUserId,
        price_inr: price ? Number(price) : null,
        note: note.trim() || null,
      });
      if (error) throw error;
      toast.success("Transfer initiated. The buyer will be notified.");
      qc.invalidateQueries({ queryKey: ["transfer", listing.id] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-coral" /> Transfer ownership
          </SheetTitle>
          <SheetDescription>
            Send the pet to the buyer's PetOS account. They'll confirm before it moves.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4 pb-6">
          <div>
            <Label>Buyer's email</Label>
            <Input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} type="email" placeholder="buyer@example.com" />
            <div className="text-[11px] text-muted-foreground mt-1">They must already have a PetOS account.</div>
          </div>
          <div>
            <Label>Final price (₹, optional)</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the buyer should confirm…" />
          </div>
          <Card className="rounded-xl bg-amber-500/10 border-amber-500/30 p-3 text-[12px] leading-relaxed">
            On accept, the pet's owner becomes the buyer and this listing is marked sold. This is irreversible.
          </Card>
          <Button onClick={submit} disabled={saving} className="w-full rounded-xl h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send transfer request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Shown on the listing detail page to display the current pending transfer
 * to whichever side is viewing (seller sees cancel, buyer sees accept/decline).
 */
export function TransferStatusCard({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: transfer } = useQuery({
    queryKey: ["transfer", listingId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ownership_transfers")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!transfer || !user) return null;

  const isSeller = transfer.from_user_id === user.id;
  const isBuyer = transfer.to_user_id === user.id;
  if (!isSeller && !isBuyer) return null;

  const update = async (status: "accepted" | "declined" | "cancelled") => {
    const { error } = await supabase
      .from("ownership_transfers")
      .update({ status })
      .eq("id", transfer.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "accepted" ? "Welcome home! Pet added to your account." :
      status === "declined" ? "Transfer declined." :
      "Transfer cancelled."
    );
    qc.invalidateQueries({ queryKey: ["transfer", listingId] });
    qc.invalidateQueries({ queryKey: ["pet-listing", listingId] });
  };

  if (transfer.status === "accepted") {
    return (
      <Card className="rounded-2xl bg-leaf/10 border-leaf/30 p-3 mb-3 flex gap-2 text-[12px]">
        <CheckCircle2 className="h-4 w-4 text-leaf shrink-0 mt-0.5" />
        <span>Ownership transferred. This pet is now with the new owner.</span>
      </Card>
    );
  }
  if (transfer.status === "declined" || transfer.status === "cancelled") {
    return (
      <Card className="rounded-2xl bg-muted/40 border-hairline p-3 mb-3 flex gap-2 text-[12px]">
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <span>Transfer {transfer.status}.</span>
      </Card>
    );
  }

  // pending
  return (
    <Card className="rounded-2xl bg-coral/10 border-coral/30 p-3 mb-3">
      <div className="flex gap-2 text-[12px] mb-2">
        <Clock className="h-4 w-4 text-coral shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Ownership transfer pending</div>
          {transfer.price_inr ? (
            <div className="text-muted-foreground">Final price: ₹{transfer.price_inr.toLocaleString("en-IN")}</div>
          ) : null}
          {transfer.note && <div className="text-muted-foreground mt-1">{transfer.note}</div>}
        </div>
      </div>
      {isBuyer && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => update("accepted")} className="flex-1 rounded-xl">Accept</Button>
          <Button size="sm" variant="outline" onClick={() => update("declined")} className="flex-1 rounded-xl">Decline</Button>
        </div>
      )}
      {isSeller && (
        <Button size="sm" variant="outline" onClick={() => update("cancelled")} className="w-full rounded-xl">
          Cancel transfer
        </Button>
      )}
    </Card>
  );
}