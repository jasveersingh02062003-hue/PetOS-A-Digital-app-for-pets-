import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/logError";

const CONFIRM_PHRASE = "delete my account";

export default function DeleteAccount() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    nav("/auth");
    return null;
  }

  const canDelete = confirm.trim().toLowerCase() === CONFIRM_PHRASE && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { reason: reason.slice(0, 500) || null },
      });
      if (error) throw error;
      toast.success("Your account has been deleted.");
      await signOut();
      nav("/", { replace: true });
    } catch (e: any) {
      logError(e, { source: "client:delete-account" });
      toast.error(e?.message ?? "Could not delete account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="container-app pad-top-safe pb-12">
      <header className="pt-6 pb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">Delete account</h1>
      </header>

      <Card className="rounded-2xl border-hairline bg-destructive/5 border-destructive/20 p-5 mb-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <div className="font-medium text-destructive">This cannot be undone.</div>
            <p className="text-muted-foreground">
              Deleting your account will permanently remove:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Your profile, pets, and all health records</li>
              <li>Your posts, comments, and likes</li>
              <li>Vault documents, vaccinations, and missing-pet listings</li>
              <li>Your orders, bookings, and mating history</li>
            </ul>
            <p className="text-muted-foreground">
              We keep an anonymised audit record (for fraud prevention) as required by law.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Why are you leaving? (optional)</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Help us improve Petos for others"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
          />
        </div>

        <Button
          variant="destructive"
          className="w-full h-12"
          disabled={!canDelete}
          onClick={handleDelete}
        >
          {busy ? "Deleting…" : "Delete my account permanently"}
        </Button>

        <Button variant="ghost" className="w-full" onClick={() => nav(-1)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
