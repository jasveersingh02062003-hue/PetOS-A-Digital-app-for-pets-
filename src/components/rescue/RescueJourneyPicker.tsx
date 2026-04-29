import { useState } from "react";
import { Heart, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgRescueJourneys } from "@/hooks/useRescueJourneys";
import { toast } from "sonner";

/**
 * Composer add-on for shelter/rescuer accounts: pick an active rescue
 * journey to attach this post to, or quick-create a new one.
 */
export const RescueJourneyPicker = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: journeys } = useOrgRescueJourneys(user?.id);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const inCare = (journeys ?? []).filter((j) => j.status === "in_care");

  const create = async () => {
    if (!user) return;
    if (!newTitle.trim()) return toast.error("Give the journey a title");
    setBusy(true);
    const { data, error } = await supabase
      .from("rescue_journeys")
      .insert({ org_id: user.id, title: newTitle.trim() })
      .select("id, title, status, started_at, cover_url, pet_id")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create");
    qc.invalidateQueries({ queryKey: ["rescue-journeys", user.id] });
    onChange(data.id);
    setCreating(false);
    setNewTitle("");
    toast.success("Journey started — Day 1");
  };

  return (
    <div className="rounded-xl border border-hairline bg-lilac/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-lilac">
        <Heart className="h-3.5 w-3.5" fill="currentColor" /> Tag a Rescue Journey
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-2.5 h-7 rounded-full text-[11px] font-medium border ${
            value === null
              ? "bg-foreground text-background border-foreground"
              : "bg-card border-hairline text-muted-foreground"
          }`}
        >
          None
        </button>
        {inCare.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => onChange(j.id)}
            className={`px-2.5 h-7 rounded-full text-[11px] font-medium border max-w-[180px] truncate ${
              value === j.id
                ? "bg-lilac text-lilac-foreground border-lilac"
                : "bg-card border-hairline text-foreground"
            }`}
            title={j.title}
          >
            {j.title}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex gap-1.5 items-center pt-1">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Tommy — found near LBS Marg"
            className="h-8 text-xs"
            maxLength={80}
          />
          <Button
            type="button"
            size="sm"
            onClick={create}
            disabled={busy}
            className="h-8 text-xs px-3 bg-lilac text-lilac-foreground hover:bg-lilac/90"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Start"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewTitle("");
            }}
            className="text-[11px] text-muted-foreground px-1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 text-[11px] text-lilac font-semibold hover:underline"
        >
          <Plus className="h-3 w-3" /> New journey
        </button>
      )}
    </div>
  );
};