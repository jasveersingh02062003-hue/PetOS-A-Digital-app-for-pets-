import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Heart, IndianRupee } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [200, 500, 1000, 2500];

/**
 * Pledge a recurring monthly sponsorship for a specific animal at a sanctuary.
 * Inserts into the `sponsorships` table; the DB trigger notifies the org.
 */
export function SponsorSheet({
  open,
  onOpenChange,
  orgUserId,
  listingId,
  listingTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgUserId: string;
  listingId?: string | null;
  listingTitle?: string;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(500);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const pledge = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to sponsor");
      if (amount < 50) throw new Error("Minimum ₹50 / month");
      const { error } = await supabase.from("sponsorships").insert({
        sponsor_id: user.id,
        org_user_id: orgUserId,
        listing_id: listingId ?? null,
        amount_inr: amount,
        message: message.trim() || null,
        anonymous,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thank you — you're now a sponsor 💛");
      qc.invalidateQueries({ queryKey: ["sponsorships-mine"] });
      qc.invalidateQueries({ queryKey: ["sponsorships-listing", listingId] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e?.message?.includes("Sign in")) {
        nav("/auth");
      } else {
        toast.error(e?.message ?? "Could not pledge");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-coral" fill="currentColor" />
            Sponsor monthly
          </DialogTitle>
          <DialogDescription>
            {listingTitle
              ? `Help cover food, vet care and shelter for ${listingTitle}.`
              : "Help cover food, vet care and shelter for the animals here."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="text-xs">Monthly amount</Label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                aria-pressed={amount === p}
                className={`h-10 rounded-xl border text-sm font-semibold transition ${
                  amount === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-hairline hover:text-foreground"
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>
          <div className="relative mt-2">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              min={50}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
              className="pl-9 rounded-xl"
              aria-label="Custom monthly amount"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Charged monthly. You can cancel anytime.
          </p>
        </div>

        <div>
          <Label htmlFor="sponsor-msg" className="text-xs">Message (optional, public)</Label>
          <Textarea
            id="sponsor-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Sending love from afar 💛"
            rows={2}
            className="rounded-xl mt-1"
            maxLength={140}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4"
          />
          Sponsor anonymously
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pledge.isPending}>
            Cancel
          </Button>
          <Button onClick={() => pledge.mutate()} disabled={pledge.isPending || amount < 50} className="gap-1.5">
            {pledge.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Pledge ₹{amount}/mo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}