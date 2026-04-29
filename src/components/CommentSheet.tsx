import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { useBlockedIds } from "@/hooks/useBlockedIds";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Trash2, User as UserIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { SellerBadge } from "@/components/SellerBadge";
import { useVerifiedOrgs } from "@/hooks/useVerifiedOrgs";
import { getRoleRing, isOrgRole } from "@/lib/roleTheme";
import { AuthorIdentity } from "@/components/AuthorIdentity";
import { UserStreakChip } from "@/components/social/UserStreakChip";

export const CommentSheet = ({ postId, onOpenChange }: { postId: string | null; onOpenChange: (open: boolean) => void }) => {
  const { user } = useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [asPetId, setAsPetId] = useState<string | "self">("self");
  const [sending, setSending] = useState(false);
  const { data: verifiedOrgs } = useVerifiedOrgs();
  const { data: blocked } = useBlockedIds();

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", postId, blocked?.size ?? 0],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_comments").select("*").eq("post_id", postId!).order("created_at");
      if (error) throw error;
      const visible = (data ?? []).filter((c: any) => !blocked || !blocked.has(c.author_id));
      const ids = [...new Set(visible.map((c) => c.author_id))];
      const petIds = [...new Set(visible.map((c: any) => c.pet_id).filter(Boolean))];
      const profsRes = ids.length
        ? await supabase.rpc("get_profiles_public")
        : { data: [] as any[] };
      const profs = (profsRes.data ?? []).filter((p: any) => ids.includes(p.id));
      const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const petsRes = petIds.length
        ? await supabase.from("pets").select("id, name, avatar_url").in("id", petIds as any)
        : { data: [] as any[] };
      const petMap = new Map((petsRes.data ?? []).map((p: any) => [p.id, p]));
      return visible.map((c: any) => ({ ...c, author: m.get(c.author_id), pet: c.pet_id ? petMap.get(c.pet_id) : null }));
    },
  });

  useEffect(() => {
    if (!postId) return;
    const ch = supabase
      .channel(`comments-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` }, () => {
        qc.invalidateQueries({ queryKey: ["comments", postId] });
        qc.invalidateQueries({ queryKey: ["feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, qc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in");
    if (!body.trim() || !postId) return;
    setSending(true);
    const payload: any = {
      post_id: postId,
      author_id: user.id,
      body: body.trim(),
    };
    if (asPetId !== "self") payload.pet_id = asPetId;
    const { error } = await supabase.from("post_comments").insert(payload);
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Sheet open={!!postId} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[80vh] flex flex-col p-0">
        <SheetHeader className="p-5 border-b border-hairline">
          <SheetTitle className="font-display text-xl text-left">Comments</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !comments?.length ? (
            <div className="text-center text-sm text-muted-foreground py-12">Be the first to comment.</div>
          ) : comments.map((c: any) => {
            const asPet = !!c.pet;
            const name = asPet ? c.pet.name : (c.author?.full_name ?? "Pet parent");
            const avatar = asPet ? c.pet.avatar_url : c.author?.avatar_url;
            const commentAccountType = (c.author?.account_type ?? "pet_parent") as string;
            const orgAuthor = !asPet && isOrgRole(commentAccountType);
            return (
              <div key={c.id} className="flex gap-3 group">
                {orgAuthor ? (
                  <div className="flex-1 min-w-0">
                    <AuthorIdentity
                      userId={c.author_id}
                      fallbackName={c.author?.full_name}
                      fallbackAvatar={c.author?.avatar_url}
                      fallbackAccountType={commentAccountType}
                      size="sm"
                      subline={
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      }
                    />
                    <p className="text-sm text-ink-soft mt-1 whitespace-pre-wrap break-words pl-9">{c.body}</p>
                  </div>
                ) : (
                  <>
                <Avatar
                  className={`h-8 w-8 shrink-0 ring-2 ring-offset-2 ring-offset-background ${getRoleRing(
                    asPet ? "pet_parent" : c.author?.account_type,
                  )}`}
                >
                  <AvatarImage src={avatar ?? undefined} />
                  <AvatarFallback className="bg-primary-soft text-primary text-xs">
                    {(name?.[0] ?? "P").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{name}</span>
                    {!asPet && c.author?.account_type && c.author.account_type !== "pet_parent" && (
                      <SellerBadge
                        type={c.author.account_type}
                        verified={verifiedOrgs?.has(c.author_id) ?? false}
                        className="text-[9px] py-0 px-1.5 h-4"
                      />
                    )}
                    {!asPet && (!c.author?.account_type || c.author.account_type === "pet_parent") && (
                      <UserStreakChip
                        userId={c.author_id}
                        className="text-[9px] py-0 px-1.5 h-4"
                      />
                    )}
                    {asPet && <span className="text-[10px] text-primary">🐾 as pet</span>}
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-ink-soft mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                  </>
                )}
                {c.author_id === user?.id && (
                  <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="p-4 border-t border-hairline bg-card space-y-2">
          {pets && pets.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              <button
                type="button"
                onClick={() => setAsPetId("self")}
                className={`shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${asPetId === "self" ? "bg-primary text-primary-foreground border-primary" : "border-hairline bg-background"}`}
              >
                <UserIcon className="h-3 w-3" /> as me
              </button>
              {pets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAsPetId(p.id)}
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${asPetId === p.id ? "bg-primary text-primary-foreground border-primary" : "border-hairline bg-background"}`}
                >
                  🐾 as {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={asPetId === "self" ? "Add a comment…" : "Comment as your pet…"}
              className="h-11 rounded-full border-hairline bg-background flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !body.trim()} className="h-11 w-11 rounded-full shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
