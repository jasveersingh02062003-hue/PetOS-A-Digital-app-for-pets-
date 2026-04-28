import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, Users } from "lucide-react";

export type CollabUser = { id: string; full_name: string | null; avatar_url: string | null };

export const CollabPicker = ({
  selected,
  onChange,
}: {
  selected: CollabUser[];
  onChange: (next: CollabUser[]) => void;
}) => {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const { data: results } = useQuery({
    queryKey: ["collab-search", q, user?.id],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_profiles_public");
      const term = q.trim().toLowerCase();
      return (data ?? [])
        .filter(
          (p: any) =>
            p.id !== user?.id &&
            !selected.find((s) => s.id === p.id) &&
            (p.full_name ?? "").toLowerCase().includes(term),
        )
        .slice(0, 6);
    },
  });

  const add = (u: CollabUser) => {
    if (selected.length >= 5) return;
    onChange([...selected, u]);
    setQ("");
  };
  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Tag collaborators (max 5)
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <Badge key={u.id} variant="secondary" className="rounded-full pl-1 pr-2 py-1 gap-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{u.full_name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{u.full_name ?? "User"}</span>
              <button type="button" onClick={() => remove(u.id)} className="ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        placeholder="Search by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-9 rounded-xl border-hairline text-sm"
      />
      {results && results.length > 0 && (
        <div className="rounded-xl border border-hairline overflow-hidden bg-background">
          {results.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{p.full_name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{p.full_name ?? "User"}</span>
              {p.city && <span className="text-xs text-muted-foreground ml-auto">{p.city}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
