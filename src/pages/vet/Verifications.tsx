import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ShieldCheck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const Verifications = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const { data: isVet } = useQuery({
    queryKey: ["is-vet-v", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["vet", "super_admin"]);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["ver-queue"],
    enabled: !!isVet,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("*, pets(name, species, breed, avatar_url, public_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: "approved" | "rejected"; notes?: string }) => {
      const { error } = await supabase
        .from("verification_requests")
        .update({ status: status as any, reviewer_id: user!.id, reviewer_notes: notes ?? null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ver-queue"] });
      toast.success("Done");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  if (!user) return <div className="p-6">Please sign in.</div>;
  if (isVet === false) return <div className="p-6 text-sm text-muted-foreground">Vet access required.</div>;

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Verifications</h1>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (items?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          Inbox zero — no pending verifications.
        </Card>
      )}

      <div className="space-y-3">
        {items?.map((it: any) => (
          <Card key={it.id} className="rounded-2xl border-hairline p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                {it.pets?.avatar_url && <img src={it.pets.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{it.pets?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[it.pets?.breed, it.pets?.species].filter(Boolean).join(" · ")}
                  {it.pets?.public_id ? ` · ${it.pets.public_id}` : ""}
                </div>
              </div>
            </div>
            {it.notes && (
              <div className="mt-2 text-xs text-muted-foreground border-l-2 border-hairline pl-2">{it.notes}</div>
            )}
            <Textarea
              placeholder="Reviewer notes (optional)"
              className="mt-3 min-h-[60px] text-sm"
              value={notesById[it.id] ?? ""}
              onChange={(e) => setNotesById((v) => ({ ...v, [it.id]: e.target.value }))}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: it.id, status: "rejected", notes: notesById[it.id] })}
              >
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button
                className="rounded-full"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: it.id, status: "approved", notes: notesById[it.id] })}
              >
                {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                Approve
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Verifications;
