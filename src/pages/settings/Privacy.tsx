import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "./SettingsLayout";
import { ShieldCheck, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { logError } from "@/lib/logError";
import { getStoredConsent, setAnalyticsConsent } from "@/lib/analytics";

const Privacy = () => {
  useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [consent, setConsent] = useState<"granted" | "denied" | null>(getStoredConsent());

  const toggleDiscoverable = async (id: string, v: boolean, verified: boolean) => {
    if (v && !verified) {
      return toast.error("Upload vaccine cert first to be discoverable");
    }
    const { error } = await supabase.from("pets").update({ discoverable_for_mating: v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pets"] });
    toast.success("Updated");
  };

  const downloadMyData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-export");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petos-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e) {
      logError(e, { source: "client:data-export" });
      toast.error("Could not export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const updateConsent = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setConsent(granted ? "granted" : "denied");
    toast.success(granted ? "Analytics enabled" : "Analytics disabled");
  };

  return (
    <SettingsLayout title="Privacy" subtitle="Per-pet discoverability" savable={false}>
      {(pets ?? []).map((p) => {
        const isNeutered = !!p.neutered;
        return (
          <div key={p.id} className="bg-card border border-hairline rounded-2xl p-4 space-y-2">
            <label className={`flex items-center justify-between gap-4 ${isNeutered ? "opacity-80" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <span className="font-display">{p.name[0]}</span>}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {p.vaccination_verified ? <><ShieldCheck className="h-3 w-3 text-primary" /> Verified</> : "Not verified"}
                  </div>
                </div>
              </div>
              <Switch
                checked={isNeutered ? false : p.discoverable_for_mating}
                disabled={isNeutered}
                onCheckedChange={(v) => !isNeutered && toggleDiscoverable(p.id, v, p.vaccination_verified)}
              />
            </label>
            {isNeutered && (
              <p className="text-[11px] text-muted-foreground leading-snug pl-13">
                Since {p.name} is neutered, mating discovery stays off. Every other feature still works normally.
              </p>
            )}
          </div>
        );
      })}
      {(!pets || pets.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No pets yet.</p>}

      <div className="bg-card border border-hairline rounded-2xl p-4 space-y-3 mt-6">
        <div className="text-sm font-medium">Analytics</div>
        <p className="text-xs text-muted-foreground leading-snug">
          First-party usage analytics only. No third-party trackers.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm">Allow analytics</span>
          <Switch
            checked={consent === "granted"}
            onCheckedChange={updateConsent}
          />
        </div>
      </div>

      <div className="bg-card border border-hairline rounded-2xl p-4 space-y-3 mt-4">
        <div className="text-sm font-medium">Your data</div>
        <p className="text-xs text-muted-foreground leading-snug">
          Download a copy of everything we have about you, or permanently
          delete your account.
        </p>
        <Button variant="outline" className="w-full" onClick={downloadMyData} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "Preparing…" : "Download my data"}
        </Button>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" asChild>
          <Link to="/account/delete">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete my account
          </Link>
        </Button>
      </div>
    </SettingsLayout>
  );
};

export default Privacy;
