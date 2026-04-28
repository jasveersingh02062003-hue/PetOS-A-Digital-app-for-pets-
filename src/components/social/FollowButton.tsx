import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollows";
import { UserPlus, UserCheck } from "lucide-react";

export const FollowButton = ({ targetId, size = "sm" }: { targetId: string; size?: "sm" | "default" }) => {
  const { user } = useAuth();
  const { data: isFollowing } = useIsFollowing(targetId);
  const toggle = useToggleFollow();

  if (!user || user.id === targetId) return null;

  return (
    <Button
      size={size}
      variant={isFollowing ? "outline" : "default"}
      onClick={(e) => { e.stopPropagation(); toggle.mutate({ targetId, isFollowing: !!isFollowing }); }}
      disabled={toggle.isPending}
      className="rounded-full"
    >
      {isFollowing ? <><UserCheck className="h-4 w-4 mr-1.5" /> Following</> : <><UserPlus className="h-4 w-4 mr-1.5" /> Follow</>}
    </Button>
  );
};
