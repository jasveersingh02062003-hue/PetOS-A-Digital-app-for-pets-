import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "./SettingsLayout";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UserX } from "lucide-react";

export default function BlockedAccounts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["blocked-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("blocked_users")
        .select("blocked_id, created_at")
        .eq("blocker_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r: any) => r.blocked_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.rpc("get_profiles_public");
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (rows ?? []).map((r: any) => ({
        id: r.blocked_id,
        created_at: r.created_at,
        profile: map.get(r.blocked_id) as any,
      }));
    },
  });

  async function unblock(id: string) {
    const { error } = await supabase.from("blocked_users")
      .delete().eq("blocker_id", user!.id).eq("blocked_id", id);
    if (error) return toast.error(error.message);
    toast.success("Unblocked");
    qc.invalidateQueries({ queryKey: ["blocked-list"] });
    qc.invalidateQueries({ queryKey: ["blocked-ids", user!.id] });
  }

  return (
    <SettingsLayout title="Blocked accounts" subtitle="People you've blocked from interacting with you">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
          You haven't blocked anyone.
        </div>
      )}
      <div className="space-y-2">
        {data?.map((b) => (
          <div key={b.id} className="flex items-center gap-3 bg-card border border-hairline rounded-2xl p-3">
            {b.profile?.avatar_url ? (
              <img src={b.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <Link to={`/u/${b.id}`} className="text-sm font-medium hover:underline truncate block">
                {b.profile?.full_name || "Unknown user"}
              </Link>
              <div className="text-[11px] text-muted-foreground">
                Blocked {new Date(b.created_at).toLocaleDateString()}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => unblock(b.id)}>Unblock</Button>
          </div>
        ))}
      </div>
    </SettingsLayout>
  );
}
