import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const CommentSheet = ({ postId, onOpenChange }: { postId: string | null; onOpenChange: (open: boolean) => void }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_comments").select("*").eq("post_id", postId!).order("created_at");
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((c) => c.author_id))];
      const profsRes = ids.length
        ? await supabase.rpc("get_profiles_public")
        : { data: [] as any[] };
      const profs = (profsRes.data ?? []).filter((p: any) => ids.includes(p.id));
      const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((c) => ({ ...c, author: m.get(c.author_id) }));
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
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId, author_id: user.id, body: body.trim(),
    });
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
          ) : comments.map((c: any) => (
            <div key={c.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.author?.avatar_url} />
                <AvatarFallback className="bg-primary-soft text-primary text-xs">
                  {(c.author?.full_name?.[0] ?? "P").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{c.author?.full_name ?? "Pet parent"}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm text-ink-soft mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {c.author_id === user?.id && (
                <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="p-4 border-t border-hairline flex items-center gap-2 bg-card">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="h-11 rounded-full border-hairline bg-background flex-1"
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim()} className="h-11 w-11 rounded-full shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
