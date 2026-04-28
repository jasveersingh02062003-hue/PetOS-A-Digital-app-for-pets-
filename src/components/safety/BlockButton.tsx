import { Button } from "@/components/ui/button";
import { UserX, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function BlockButton({ userId, size = "sm" }: { userId: string; size?: "sm" | "default" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isMe = user?.id === userId;

  const { data: blocked } = useQuery({
    queryKey: ["blocked", user?.id, userId],
    enabled: !!user && !isMe,
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocker_id", user!.id)
        .eq("blocked_id", userId)
        .maybeSingle();
      return !!data;
    },
  });

  if (!user || isMe) return null;

  const toggle = async () => {
    if (blocked) {
      const { error } = await supabase.from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId);
      if (error) return toast.error(error.message);
      toast.success("Unblocked");
    } else {
      if (!confirm("Block this person? You won't see their posts, comments, or messages.")) return;
      const { error } = await supabase.from("blocked_users").insert({
        blocker_id: user.id,
        blocked_id: userId,
      });
      if (error) return toast.error(error.message);
      toast.success("Blocked");
    }
    qc.invalidateQueries({ queryKey: ["blocked"] });
    qc.invalidateQueries({ queryKey: ["blocked-ids", user.id] });
  };

  return (
    <Button size={size} variant={blocked ? "outline" : "ghost"} onClick={toggle}>
      {blocked ? <><UserCheck className="w-4 h-4 mr-1" /> Unblock</> : <><UserX className="w-4 h-4 mr-1" /> Block</>}
    </Button>
  );
}
