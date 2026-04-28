import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useIsMember, useToggleMembership, type Group } from "@/hooks/useGroups";
import { Users } from "lucide-react";

export const GroupCard = ({ group, compact = false }: { group: Group; compact?: boolean }) => {
  const { data: isMember } = useIsMember(group.id);
  const toggle = useToggleMembership();

  const kindBadge =
    group.kind === "breed" ? "Breed" : group.kind === "city" ? "City" : "Interest";

  return (
    <div className={`rounded-2xl border border-border bg-card ${compact ? "p-3" : "p-4"} flex items-center gap-3`}>
      <Link to={`/g/${group.slug}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{kindBadge}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> {group.member_count}
          </span>
        </div>
        <h3 className="font-display text-base mt-0.5 truncate">{group.name}</h3>
        {!compact && group.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{group.description}</p>
        )}
      </Link>
      <Button
        size="sm"
        variant={isMember ? "outline" : "default"}
        className="rounded-full shrink-0"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ groupId: group.id, isMember: !!isMember })}
      >
        {isMember ? "Joined" : "Join"}
      </Button>
    </div>
  );
};
