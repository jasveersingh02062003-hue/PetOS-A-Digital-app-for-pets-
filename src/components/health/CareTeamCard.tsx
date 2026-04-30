import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Stethoscope, UserPlus, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * CareTeamCard — owner-only widget on a pet's Health tab.
 * Lists vets currently granted access to the pet and lets the owner
 * invite a vet by email or revoke existing access.
 */
export function CareTeamCard({ petId }: { petId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["care-team", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_care_team" as any)
        .select("id, vet_id, granted_at")
        .eq("pet_id", petId)
        .is("revoked_at", null);
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.vet_id);
      if (!ids.length) return [];
      const { data: vets } = await supabase
        .from("vet_profiles" as any)
        .select("user_id, display_name, clinic_name, photo_url")
        .in("user_id", ids);
      return (data ?? []).map((row: any) => ({
        ...row,
        vet: (vets ?? []).find((v: any) => v.user_id === row.vet_id),
      }));
    },
  });

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("pet_care_team" as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    qc.invalidateQueries({ queryKey: ["care-team", petId] });
  };

  return (
    <>
      <Card className="rounded-2xl border-hairline p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span className="font-display text-base">Care team</span>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add vet
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Vets you add can view this pet's health records and add visit notes.
        </p>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : team.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No vets added yet.</div>
        ) : (
          <div className="space-y-2">
            {team.map((row: any) => (
              <div key={row.id} className="flex items-center gap-3 rounded-xl border border-hairline p-2">
                <div className="h-9 w-9 rounded-full bg-primary-soft overflow-hidden grid place-items-center">
                  {row.vet?.photo_url ? (
                    <img src={row.vet.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Stethoscope className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{row.vet?.display_name ?? "Vet"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{row.vet?.clinic_name ?? ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => revoke(row.id)} aria-label="Revoke">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <AddVetSheet
        open={open}
        onOpenChange={setOpen}
        petId={petId}
        onAdded={() => qc.invalidateQueries({ queryKey: ["care-team", petId] })}
      />
    </>
  );
}

function AddVetSheet({
  open,
  onOpenChange,
  petId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  petId: string;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["vet-search-careteam", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_profiles" as any)
        .select("user_id, display_name, clinic_name, city, photo_url")
        .eq("active", true)
        .or(`display_name.ilike.%${q}%,clinic_name.ilike.%${q}%`)
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  const grant = async (vetId: string) => {
    setAdding(vetId);
    const { error } = await supabase.from("pet_care_team" as any).insert({ pet_id: petId, vet_id: vetId });
    setAdding(null);
    if (error) {
      if (error.code === "23505") return toast.info("Vet already on the team");
      return toast.error(error.message);
    }
    toast.success("Vet added to care team");
    onAdded();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Add a vet</SheetTitle>
          <SheetDescription>Search by vet or clinic name.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4 pb-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dr. Sharma, Happy Tails…" />
          </div>
          {q.trim().length < 2 ? (
            <div className="text-xs text-muted-foreground">Type at least 2 characters.</div>
          ) : isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : results.length === 0 ? (
            <div className="text-xs text-muted-foreground">No vets found.</div>
          ) : (
            <div className="space-y-2">
              {results.map((v: any) => (
                <div key={v.user_id} className="flex items-center gap-3 rounded-xl border border-hairline p-2">
                  <div className="h-9 w-9 rounded-full bg-primary-soft overflow-hidden grid place-items-center">
                    {v.photo_url ? <img src={v.photo_url} alt="" className="h-full w-full object-cover" /> : <Stethoscope className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{v.display_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{v.clinic_name} · {v.city || "—"}</div>
                  </div>
                  <Button size="sm" className="rounded-full" disabled={adding === v.user_id} onClick={() => grant(v.user_id)}>
                    {adding === v.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}