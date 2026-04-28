import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ModerationQueue() {
  const [tab, setTab] = useState<"reports" | "modlog">("reports");
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-3">
          <Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link>
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Moderation</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-3 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="modlog">Auto-mod log</TabsTrigger>
          </TabsList>
          <TabsContent value="reports"><ReportsList /></TabsContent>
          <TabsContent value="modlog"><ModLogList /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ReportsList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  async function resolve(id: string, status: "resolved" | "dismissed") {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reports")
      .update({ status, resolver_id: user?.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Marked resolved" : "Dismissed");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-10">No open reports 🎉</p>;

  return (
    <div className="space-y-2">
      {data.map((r: any) => (
        <Card key={r.id} className="p-3 rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {r.subject_type} · {r.reason}
              </div>
              <div className="text-sm mt-1 break-words">{r.details || <em className="text-muted-foreground">No details</em>}</div>
              <div className="text-[11px] text-muted-foreground mt-2">
                ID: <span className="font-mono">{r.subject_id.slice(0, 8)}…</span> ·
                {" "}{new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="default" onClick={() => resolve(r.id, "resolved")}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => resolve(r.id, "dismissed")}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ModLogList() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-modlog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_moderation_log")
        .select("*")
        .in("verdict", ["flag", "block"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-10">No flagged content.</p>;

  return (
    <div className="space-y-2">
      {data.map((r: any) => (
        <Card key={r.id} className="p-3 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className={`text-[11px] uppercase font-medium ${r.verdict === "block" ? "text-destructive" : "text-amber-600"}`}>
              {r.verdict} · {r.content_type}
            </span>
            <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
          </div>
          <div className="text-sm mt-1 break-words">{r.excerpt}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Reasons: {(r.reasons || []).join(", ") || "—"}{r.score != null ? ` · score ${r.score}` : ""}
          </div>
        </Card>
      ))}
    </div>
  );
}
