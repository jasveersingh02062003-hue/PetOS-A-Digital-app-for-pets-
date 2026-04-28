import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ErrRow = {
  id: string;
  source: string;
  route: string | null;
  message: string;
  stack: string | null;
  meta: any;
  user_id: string | null;
  created_at: string;
};

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;

export default function AdminErrors() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("all");
  const [range, setRange] = useState<keyof typeof RANGES>("7d");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cron, setCron] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role);
      setAuthorized(roles.includes("super_admin") || roles.includes("moderator"));
    });
  }, [user, nav]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - RANGES[range] * 86400_000).toISOString();
    let q = supabase.from("error_log").select("*").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(200);
    if (source !== "all") {
      if (source === "client") q = q.like("source", "client%");
      else if (source === "edge") q = q.like("source", "edge:%");
    }
    const [{ data: errs }, { data: ch }] = await Promise.all([
      q,
      supabase.from("cron_health").select("*").order("last_run_at", { ascending: false }),
    ]);
    setRows((errs ?? []) as ErrRow[]);
    setCron(ch ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (authorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, source, range]);

  if (authorized === null) {
    return <div className="container-app pad-top-safe pt-10 text-sm text-muted-foreground">Checking access…</div>;
  }
  if (!authorized) {
    return (
      <div className="container-app pad-top-safe pt-10 text-center">
        <div className="font-display text-xl mb-2">Not authorized</div>
        <p className="text-sm text-muted-foreground mb-4">Admin access required.</p>
        <Button onClick={() => nav("/")}>Go home</Button>
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  return (
    <div className="container-app pad-top-safe pb-12">
      <header className="pt-6 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Error log</h1>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {cron.length > 0 && (
        <Card className="rounded-2xl border-hairline p-4 mb-4">
          <div className="text-xs text-muted-foreground mb-2">Background job health</div>
          <div className="space-y-1 text-sm">
            {cron.map((c) => (
              <div key={c.job_name} className="flex items-center justify-between">
                <span className="font-mono text-xs">{c.job_name}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={c.last_status === "ok" ? "secondary" : "destructive"}>
                    {c.last_status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.last_run_at), { addSuffix: true })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="edge">Edge functions</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as any)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7d</SelectItem>
            <SelectItem value="30d">30d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">No errors in this range. ✨</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const open = expanded.has(r.id);
            return (
              <Card key={r.id} className="rounded-xl border-hairline p-3">
                <button onClick={() => toggle(r.id)} className="w-full text-left flex items-start gap-2">
                  {open ? <ChevronDown className="h-4 w-4 mt-1 shrink-0" /> : <ChevronRight className="h-4 w-4 mt-1 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{r.source}</Badge>
                      {r.route && <span className="text-xs text-muted-foreground font-mono truncate">{r.route}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm mt-1 line-clamp-2">{r.message}</div>
                  </div>
                </button>
                {open && (
                  <div className="mt-3 pt-3 border-t border-hairline space-y-2 text-xs">
                    {r.stack && (
                      <pre className="bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                        {r.stack}
                      </pre>
                    )}
                    {r.meta && (
                      <pre className="bg-muted/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(r.meta, null, 2)}
                      </pre>
                    )}
                    {r.user_id && <div className="text-muted-foreground">User: <span className="font-mono">{r.user_id}</span></div>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
