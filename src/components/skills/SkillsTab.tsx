import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Plus, Trash2, Award } from "lucide-react";
import { toast } from "sonner";
import { VouchButton } from "./VouchButton";

/**
 * Skills tab on PetProfile. Lists pet skills with their featured spotlight (if any).
 * Owner can add a new skill; a spotlight is created automatically with an empty caption,
 * which the owner can later attach to a post.
 */
export const SkillsTab = ({ petId, ownerId }: { petId: string; ownerId: string | null }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newSkill, setNewSkill] = useState("");
  const [adding, setAdding] = useState(false);

  const isOwner = !!user && user.id === ownerId;

  const { data: skills } = useQuery({
    queryKey: ["pet-skills", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_skills")
        .select("id, name, created_at")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{ id: string; name: string; created_at: string }>;
    },
  });

  const { data: spotlights } = useQuery({
    queryKey: ["pet-spotlights", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("skill_spotlights")
        .select("id, skill_id, caption, video_url, vouch_count, crowd_favourite_at, post_id")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const addSkill = async () => {
    if (!newSkill.trim() || !user) return;
    setAdding(true);
    const { data: sk, error } = await supabase
      .from("pet_skills")
      .insert({ pet_id: petId, name: newSkill.trim(), taught_by: user.id })
      .select()
      .single();
    if (error || !sk) {
      setAdding(false);
      return toast.error(error?.message ?? "Could not add skill");
    }
    // Create an initial spotlight stub for the skill so it can collect vouches.
    await supabase.from("skill_spotlights").insert({
      pet_id: petId,
      skill_id: sk.id,
      caption: `${sk.name} 🎉`,
    });
    setNewSkill("");
    setAdding(false);
    toast.success(`Added skill: ${sk.name}`);
    qc.invalidateQueries({ queryKey: ["pet-skills", petId] });
    qc.invalidateQueries({ queryKey: ["pet-spotlights", petId] });
  };

  const removeSkill = async (id: string) => {
    await supabase.from("pet_skills").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pet-skills", petId] });
    qc.invalidateQueries({ queryKey: ["pet-spotlights", petId] });
  };

  if (!skills?.length && !isOwner) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
        No skills yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOwner && (
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Sit, Roll over, Shake paw"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="rounded-xl"
            maxLength={40}
          />
          <Button onClick={addSkill} disabled={adding || !newSkill.trim()} className="rounded-xl gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      )}

      {skills?.map((sk) => {
        const spot = spotlights?.find((s) => s.skill_id === sk.id);
        return (
          <div key={sk.id} className="rounded-2xl border border-hairline p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{sk.name}</div>
                  {spot?.crowd_favourite_at && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 mt-0.5">
                      <Award className="h-3 w-3" /> Crowd-favourite
                    </div>
                  )}
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => removeSkill(sk.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Remove skill"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {spot && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-hairline">
                <div className="text-[11px] text-muted-foreground truncate">
                  {spot.caption || "Featured spotlight"}
                </div>
                <VouchButton spotlightId={spot.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};