import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Activity, AlertTriangle, Clock, Database } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CronRow = { job_name: string; last_run_at: string; last_status: string; last_error: string | null };
type EventCount = { event: string; n: number };

export default function AdminStatus() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [errCount24h, setErrCount24h] = useState<number | null>(null);
  const [errCount1h, setErrCount1h] = useState<number | null>(null);
  const [cron, setCron] = useState<CronRow[]>([]);
  const [events24h, setEvents24h] = useState<EventCount[]>([]);
  const [activeUsers24h, setActiveUsers24h] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role);
      setAuthorized(roles.includes("super_admin") || roles.includes("moderator"));
    });
  }, [user, nav]);

  const load = async () => {
    setLoading(true);
    const t0 = performance.now();
    // Tiny round-trip to measure DB latency
    await supabase.from("error_log").select("id", { count: "exact", head: true }).limit(1);
    setDbLatency(Math.round(performance.now() - t0));

    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const since1h = new Date(Date.now() - 3600_000).toISOString();

    const [{ count: c24 }, { count: c1 }, { data: ch }, { data: evs }] = await Promise.all([
      supabase.from("error_log").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      supabase.from("error_log").select("id", { count: "exact", head: true }).gte("created_at", since1h),
      supabase.from("cron_health").select("*").order("last_run_at", { ascending: false }),
      supabase.from("analytics_events").select("event, user_id").gte("created_at", since24h).limit(5000),
    ]);
    setErrCount24h(c24 ?? 0);
    setErrCount1h(c1 ?? 0);
    setCron((ch ?? []) as CronRow[]);

    const counts = new Map<string, number>();
    const users = new Set<string>();
    for (const r of (evs ?? []) as { event: string; user_id: string | null }[]) {
      counts.set(r.event, (counts.get(r.event) ?? 0) + 1);
      if (r.user_id) users.add(r.user_id);
    }
    setEvents24h([...counts.entries()].map(([event, n]) => ({ event, n })).sort((a, b) => b.n - a.n));
    setActiveUsers24h(users.size);
    setLoading(false);
  };

  useEffect(() => {
    if (authorized) void load();
  }, [authorized]);

  const cronUnhealthy = useMemo(
    () => cron.filter((c) => c.last_status !== "ok").length,
    [cron],
  );

  if (authorized === null) return <div className="p-8 text-sm text-muted-foreground">Checking access…</div>;
  if (!authorized) return (
    <div className="container-app pad-top-safe pb-24">
      <Card className="p-8 text-center mt-8 rounded-2xl border-hairline">
        <div className="font-display text-lg">Admins only</div>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page.</p>
      </Card>
    </div>
  );

  const dbHealth = dbLatency === null ? "…" : dbLatency < 200 ? "Healthy" : dbLatency < 800 ? "Slow" : "Degraded";
  const dbTone = dbLatency === null ? "secondary" : dbLatency < 200 ? "default" : dbLatency < 800 ? "secondary" : "destructive";

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">System status</h1>
        <Button variant="outline" size="sm" className="rounded-full" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Card className="p-4 rounded-2xl border-hairline">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" /> DB latency</div>
          <div className="font-display text-2xl mt-1">{dbLatency ?? "…"}<span className="text-sm text-muted-foreground"> ms</span></div>
          <Badge variant={dbTone as any} className="mt-2">{dbHealth}</Badge>
        </Card>

        <Card className="p-4 rounded-2xl border-hairline">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Errors 1h</div>
          <div className="font-display text-2xl mt-1">{errCount1h ?? "…"}</div>
          <Badge variant={errCount1h && errCount1h > 5 ? "destructive" : "secondary"} className="mt-2">
            {errCount1h && errCount1h > 5 ? "Spike" : "Normal"}
          </Badge>
        </Card>

        <Card className="p-4 rounded-2xl border-hairline">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Errors 24h</div>
          <div className="font-display text-2xl mt-1">{errCount24h ?? "…"}</div>
        </Card>

        <Card className="p-4 rounded-2xl border-hairline">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Active users 24h</div>
          <div className="font-display text-2xl mt-1">{activeUsers24h ?? "…"}</div>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" /> Scheduled jobs
          {cronUnhealthy > 0 && (
            <Badge variant="destructive" className="ml-2">{cronUnhealthy} failing</Badge>
          )}
        </h2>
        <Card className="rounded-2xl border-hairline mt-2 divide-y">
          {cron.length === 0 && <div className="p-4 text-sm text-muted-foreground">No cron health data yet.</div>}
          {cron.map((c) => (
            <div key={c.job_name} className="p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{c.job_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.last_run_at ? `Last run ${formatDistanceToNow(new Date(c.last_run_at), { addSuffix: true })}` : "never"}
                  {c.last_error && <span className="text-coral"> — {c.last_error}</span>}
                </div>
              </div>
              <Badge variant={c.last_status === "ok" ? "secondary" : "destructive"}>
                {c.last_status}
              </Badge>
            </div>
          ))}
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Activity className="h-4 w-4" /> Top events (24h)
        </h2>
        <Card className="rounded-2xl border-hairline mt-2 divide-y">
          {events24h.length === 0 && <div className="p-4 text-sm text-muted-foreground">No events recorded yet.</div>}
          {events24h.slice(0, 15).map((e) => (
            <div key={e.event} className="p-3 flex items-center justify-between text-sm">
              <span className="font-mono text-xs">{e.event}</span>
              <span className="font-medium">{e.n}</span>
            </div>
          ))}
        </Card>
      </section>

      <p className="text-[11px] text-muted-foreground mt-6 text-center">
        Live snapshot. Errors → <a className="underline" href="/admin/errors">/admin/errors</a>.
      </p>
    </div>
  );
}