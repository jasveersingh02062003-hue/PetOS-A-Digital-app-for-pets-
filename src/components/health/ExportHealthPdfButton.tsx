import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTier } from "@/hooks/useTier";

type Range = "all" | "12m" | "6m";

export const ExportHealthPdfButton = ({ petId, petName }: { petId: string; petName: string }) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [includeOwner, setIncludeOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { data: tierInfo } = useTier();
  const isPlus = tierInfo?.tier === "plus";

  const run = async () => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sign in required");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-export-pdf`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ pet_id: petId, range, include_owner: includeOwner }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const safe = (petName || "pet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.download = `${safe}-health-passport-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF downloaded");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 border-hairline">
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Export health passport</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 py-5">
          <div className="space-y-2">
            <Label>Date range</Label>
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-hairline p-3">
            <div>
              <Label className="text-sm">Include owner contact</Label>
              <p className="text-xs text-muted-foreground">Adds your name, city, phone to the cover.</p>
            </div>
            <Switch checked={includeOwner} onCheckedChange={setIncludeOwner} />
          </div>

          {!isPlus && (
            <button
              onClick={() => nav("/plus")}
              className="w-full text-left rounded-xl bg-primary-soft border border-primary/20 p-3 flex items-start gap-2"
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-medium text-primary">Plus removes the watermark</div>
                <div className="text-muted-foreground">Free preview is fully usable; Plus gives a clean print-ready export.</div>
              </div>
            </button>
          )}

          <Button onClick={run} disabled={busy} size="lg" className="w-full rounded-xl">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Download className="h-4 w-4 mr-2" />Download PDF</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};