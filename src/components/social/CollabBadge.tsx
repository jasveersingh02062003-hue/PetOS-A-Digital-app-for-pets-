import { Link } from "react-router-dom";
import { usePostCollaborators } from "@/hooks/useCollabs";
import { Users } from "lucide-react";

export const CollabBadge = ({ postId }: { postId: string }) => {
  const { data } = usePostCollaborators(postId);
  if (!data?.length) return null;

  const names = data.slice(0, 3).map((c: any) => c.profile?.full_name ?? "User");
  const extra = data.length - names.length;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
      <Users className="h-3 w-3" />
      <span>with </span>
      {data.slice(0, 3).map((c: any, i: number) => (
        <span key={c.user_id}>
          <Link to={`/u/${c.user_id}`} className="font-medium text-foreground hover:underline">
            {c.profile?.full_name ?? "User"}
          </Link>
          {i < Math.min(data.length, 3) - 1 ? ", " : ""}
        </span>
      ))}
      {extra > 0 && <span> +{extra}</span>}
    </div>
  );
};
