import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { SettingsLayout } from "./SettingsLayout";
import { ShieldCheck } from "lucide-react";

const Privacy = () => {
  useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();

  const toggleDiscoverable = async (id: string, v: boolean, verified: boolean) => {
    if (v && !verified) {
      return toast.error("Upload vaccine cert first to be discoverable");
    }
    const { error } = await supabase.from("pets").update({ discoverable_for_mating: v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pets"] });
    toast.success("Updated");
  };

  return (
    <SettingsLayout title="Privacy" subtitle="Per-pet discoverability" savable={false}>
      {(pets ?? []).map((p) => (
        <label key={p.id} className="flex items-center justify-between gap-4 bg-card border border-hairline rounded-2xl p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="font-display">{p.name[0]}</span>}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{p.name}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                {p.vaccination_verified ? <><ShieldCheck className="h-3 w-3 text-primary" /> Verified</> : "Not verified"}
              </div>
            </div>
          </div>
          <Switch
            checked={p.discoverable_for_mating}
            onCheckedChange={(v) => toggleDiscoverable(p.id, v, p.vaccination_verified)}
          />
        </label>
      ))}
      {(!pets || pets.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No pets yet.</p>}
    </SettingsLayout>
  );
};

export default Privacy;
