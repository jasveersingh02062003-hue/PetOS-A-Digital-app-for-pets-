import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, ShieldCheck, Stethoscope, Flag, Users, BadgeCheck, BarChart3, Megaphone, ToggleRight, Coins, FileCheck2, Bug, Shield } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { toast } from "sonner";
import { InsuranceTab } from "@/components/admin/InsuranceTab";

type Role = "user" | "moderator" | "super_admin" | "vet";

const Admin = () => {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/auth", { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map(r => r.role);
      setAllowed(roles.includes("super_admin") || roles.includes("moderator"));
    })();
  }, [user, authLoading, nav]);

  if (allowed === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin h-5 w-5" /></div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div className="space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="font-display text-2xl">Admins only</h1>
          <p className="text-sm text-muted-foreground">You don't have access to this area.</p>
          <Button onClick={() => nav("/")} variant="outline">Go home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="font-display text-lg leading-tight">Admin</div>
            <div className="text-[11px] text-muted-foreground">Moderation & operations</div>
          </div>
        </div>
      </header>

      <main className="container-app py-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-11 w-full bg-muted rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg gap-1.5"><BarChart3 className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg gap-1.5"><Flag className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="vets" className="rounded-lg gap-1.5"><Stethoscope className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="providers" className="rounded-lg gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="trust" className="rounded-lg gap-1.5"><FileCheck2 className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="rewards" className="rounded-lg gap-1.5"><Coins className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="insurance" className="rounded-lg gap-1.5"><Shield className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg gap-1.5"><Users className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-lg gap-1.5"><Megaphone className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="flags" className="rounded-lg gap-1.5"><ToggleRight className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="errors" className="rounded-lg gap-1.5"><Bug className="h-3.5 w-3.5" /></TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
          <TabsContent value="vets" className="mt-4"><VetAppsTab /></TabsContent>
          <TabsContent value="providers" className="mt-4"><ProvidersTab /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
          <TabsContent value="broadcast" className="mt-4"><BroadcastTab /></TabsContent>
          <TabsContent value="flags" className="mt-4"><FlagsTab /></TabsContent>
          <TabsContent value="trust" className="mt-4"><TrustQueueTab /></TabsContent>
          <TabsContent value="rewards" className="mt-4"><RewardsQueueTab /></TabsContent>
          <TabsContent value="insurance" className="mt-4"><InsuranceTab /></TabsContent>
          <TabsContent value="errors" className="mt-4"><ErrorsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const ReportsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "reviewing" | "resolved" | "dismissed") => {
    const patch: any = { status };
    if (status === "resolved" || status === "dismissed") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("reports").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;
  if (!items.length) return <p className="text-center text-sm text-muted-foreground py-12">No reports.</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a href="/admin/moderation" className="text-xs text-primary hover:underline">Open full moderation queue →</a>
      </div>
      {items.map(r => (
        <Card key={r.id} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{r.subject_type}</Badge>
              <Badge variant={r.status === "open" ? "default" : "secondary"} className="capitalize">{r.status}</Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
          </div>
          <div>
            <div className="text-sm font-medium">{r.reason}</div>
            {r.details && <div className="text-sm text-muted-foreground mt-1">{r.details}</div>}
            <div className="text-[11px] text-muted-foreground mt-1 font-mono">id: {r.subject_id}</div>
          </div>
          {r.status !== "resolved" && r.status !== "dismissed" && (
            <div className="flex gap-2 pt-1">
              {r.status === "open" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "reviewing")}>Mark reviewing</Button>
              )}
              <Button size="sm" onClick={() => setStatus(r.id, "resolved")}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "dismissed")}>Dismiss</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Errors tab — surfaces recent client/runtime errors to admins.       */
/* ------------------------------------------------------------------ */
const ErrorsTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("error_log")
      .select("id, created_at, source, route, message, stack, user_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (sourceFilter.trim()) q = q.ilike("source", `%${sourceFilter.trim()}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (loading) {
    return <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Filter by source (e.g. window, client, edge)"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
        />
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>

      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center">No errors logged 🎉</div>
      )}

      {rows.map((r) => (
        <Card key={r.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                {r.route && <span className="text-[11px] text-muted-foreground truncate">{r.route}</span>}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {formatRelative(r.created_at)}
                </span>
              </div>
              <div className="text-sm font-medium break-words">{r.message}</div>
              {r.stack && (
                <details className="mt-2">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer">stack</summary>
                  <pre className="mt-1 text-[10px] bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                    {r.stack.slice(0, 2000)}
                  </pre>
                </details>
              )}
              {r.user_id && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  user {r.user_id.slice(0, 8)}…
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

const VetAppsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vet_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("vet_applications")
      .update({ status, reviewed_by: (await supabase.auth.getUser()).data.user?.id })
      .eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Application ${status}`); load(); }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;
  if (!items.length) return <p className="text-center text-sm text-muted-foreground py-12">No applications.</p>;

  return (
    <div className="space-y-3">
      {items.map(a => (
        <Card key={a.id} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">{a.clinic_name}</div>
            <Badge variant={a.status === "pending" ? "default" : "secondary"} className="capitalize">{a.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">License: {a.license_number}{a.city ? ` · ${a.city}` : ""}</div>
          {a.bio && <div className="text-sm">{a.bio}</div>}
          {a.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => decide(a.id, "approved")}>Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => decide(a.id, "rejected")}>Reject</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

const ProvidersTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unverified" | "all">("unverified");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("service_providers").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "unverified") q = q.eq("verified", false);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const setVerified = async (id: string, verified: boolean) => {
    const { error } = await supabase.from("service_providers").update({ verified }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(verified ? "Verified" : "Unverified"); load(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "unverified" ? "default" : "outline"} onClick={() => setFilter("unverified")}>Pending</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
      </div>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />
      ) : !items.length ? (
        <p className="text-center text-sm text-muted-foreground py-12">Nothing to review.</p>
      ) : (
        items.map(p => (
          <Card key={p.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {p.name}
                  {p.verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{p.category}{p.city ? ` · ${p.city}` : ""}</div>
              </div>
              <Badge variant={p.verified ? "secondary" : "default"}>{p.verified ? "Verified" : "Pending"}</Badge>
            </div>
            {p.bio && <div className="text-sm text-muted-foreground">{p.bio}</div>}
            {p.contact_phone && <div className="text-xs text-muted-foreground">📞 {p.contact_phone}</div>}
            <div className="flex gap-2 pt-1">
              {!p.verified ? (
                <Button size="sm" onClick={() => setVerified(p.id, true)}>Verify</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setVerified(p.id, false)}>Revoke</Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

const UsersTab = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, Role[]>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase.rpc("get_profiles_public");
    const trimmed = (profs ?? []).slice(0, 100);
    const { data: rs } = await supabase.from("user_roles").select("user_id, role");
    const map: Record<string, Role[]> = {};
    (rs ?? []).forEach((r: any) => {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
    });
    setProfiles(trimmed);
    setRoles(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: Role) => {
    const has = (roles[userId] ?? []).includes(role);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Roles updated");
    load();
  };

  const filtered = profiles.filter(p =>
    !q || (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || p.id.includes(q)
  );

  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or id…"
        className="w-full h-10 px-3 rounded-xl border border-hairline bg-card text-sm"
      />
      {filtered.map(p => {
        const userRoles = roles[p.id] ?? [];
        return (
          <Card key={p.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{p.full_name || "Unnamed"}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{p.id}</div>
              </div>
              {p.city && <Badge variant="outline">{p.city}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(["user","vet","moderator","super_admin"] as Role[]).map(r => {
                const active = userRoles.includes(r);
                return (
                  <Button
                    key={r}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => toggleRole(p.id, r)}
                    className="capitalize text-xs h-7"
                  >
                    {r.replace("_"," ")}
                  </Button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const OverviewTab = () => {
  const [k, setK] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_kpis" as any);
      if (error) toast.error(error.message); else setK(data);
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;
  if (!k) return <p className="text-center text-sm text-muted-foreground py-12">No data.</p>;
  const tiles: { label: string; value: number; key: string }[] = [
    { label: "Total users", value: k.users_total, key: "users_total" },
    { label: "New users (7d)", value: k.users_new_7d, key: "users_new_7d" },
    { label: "Pets", value: k.pets_total, key: "pets_total" },
    { label: "Posts today", value: k.posts_today, key: "posts_today" },
    { label: "Bookings today", value: k.bookings_today, key: "bookings_today" },
    { label: "Active missing", value: k.active_missing, key: "active_missing" },
    { label: "Open reports", value: k.open_reports, key: "open_reports" },
    { label: "Vet apps pending", value: k.pending_vet_apps, key: "pending_vet_apps" },
    { label: "Providers pending", value: k.pending_provider_verify, key: "pending_provider_verify" },
    { label: "Active vets", value: k.vets_active, key: "vets_active" },
    { label: "Plus subscribers", value: k.plus_subscribers, key: "plus_subscribers" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map(t => (
        <Card key={t.key} className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
          <div className="font-display text-3xl mt-1">{t.value ?? 0}</div>
        </Card>
      ))}
    </div>
  );
};

const BroadcastTab = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("broadcasts" as any).select("*").order("created_at", { ascending: false }).limit(20);
    setHistory((data as any[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSending(true);
    const { error } = await supabase.rpc("send_broadcast" as any, {
      _title: title, _body: body || null, _link: link || null,
      _target_city: city || null, _target_role: role || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Broadcast sent");
    setTitle(""); setBody(""); setLink(""); setCity(""); setRole("");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-medium">New broadcast</div>
        <Input placeholder="Title (required)" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Body" value={body} onChange={e => setBody(e.target.value)} rows={3} />
        <Input placeholder="Link (e.g. /meetups)" value={link} onChange={e => setLink(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Target city (optional)" value={city} onChange={e => setCity(e.target.value)} />
          <select value={role} onChange={e => setRole(e.target.value)} className="h-10 px-3 rounded-md border border-hairline bg-card text-sm">
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="vet">Vets</option>
            <option value="moderator">Moderators</option>
          </select>
        </div>
        <Button onClick={send} disabled={sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send broadcast"}
        </Button>
      </Card>
      <div className="space-y-2">
        <div className="text-sm font-medium">Recent broadcasts</div>
        {history.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">None yet.</p>
        ) : history.map((b: any) => (
          <Card key={b.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{b.title}</div>
              <Badge variant="secondary">{b.recipients_count} sent</Badge>
            </div>
            {b.body && <div className="text-xs text-muted-foreground mt-1">{b.body}</div>}
            <div className="text-[10px] text-muted-foreground mt-1">
              {new Date(b.created_at).toLocaleString()}
              {b.target_city && ` · city: ${b.target_city}`}
              {b.target_role && ` · role: ${b.target_role}`}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const FlagsTab = () => {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("feature_flags" as any).select("*").order("key");
    setFlags((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const toggle = async (key: string, enabled: boolean) => {
    const { error } = await supabase.from("feature_flags" as any).update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    load();
  };
  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;
  return (
    <div className="space-y-2">
      {flags.map((f: any) => (
        <Card key={f.key} className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">{f.key}</div>
            {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
          </div>
          <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f.key, v)} />
        </Card>
      ))}
    </div>
  );
};

export default Admin;

const TrustQueueTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_providers")
      .select("id, name, category, owner_id, trust_status, id_proof_path, address_proof_path, years_experience, quiz_passed_at, city, created_at")
      .in("trust_status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "verified" | "rejected") => {
    const { error } = await supabase.rpc("set_provider_trust_status" as any, {
      _provider_id: id,
      _status: status,
      _notes: notes[id] || null,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Provider ${status}`); load(); }
  };

  const signedUrl = async (path: string) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("trust-docs").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };

  const openDoc = async (path: string) => {
    const url = await signedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open document");
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>;
  if (items.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">No pending verifications.</Card>;

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id} className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.category} · {p.city || "—"} · {p.years_experience ?? 0} yrs exp
              </div>
              <div className="text-xs mt-1">
                Quiz: {p.quiz_passed_at ? <Badge variant="default">passed</Badge> : <Badge variant="secondary">not passed</Badge>}
              </div>
            </div>
            <Badge variant="outline">{p.trust_status}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.id_proof_path && (
              <Button size="sm" variant="outline" onClick={() => openDoc(p.id_proof_path)}>View ID proof</Button>
            )}
            {p.address_proof_path && (
              <Button size="sm" variant="outline" onClick={() => openDoc(p.address_proof_path)}>View address proof</Button>
            )}
          </div>
          <Textarea
            placeholder="Optional notes for the provider"
            value={notes[p.id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
            className="text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(p.id, "verified")}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => decide(p.id, "rejected")}>Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

const RewardsQueueTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reward_redemptions" as any)
      .select("*")
      .in("status", ["requested", "approved"])
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "applied" | "rejected") => {
    const { error } = await supabase.rpc("apply_redemption" as any, { _id: id, _status: status });
    if (error) toast.error(error.message);
    else { toast.success(`Redemption ${status}`); load(); }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>;
  if (items.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">No pending redemptions.</Card>;

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="font-medium text-sm">{r.kind.replace(/_/g, " ")}</div>
            <div className="text-xs text-muted-foreground">
              user {r.user_id.slice(0, 8)}… · {r.points_spent} pts · ₹{r.inr_value}
            </div>
            {r.notes && <div className="text-xs italic mt-1">{r.notes}</div>}
          </div>
          <Badge variant="outline">{r.status}</Badge>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(r.id, "applied")}>Apply</Button>
            <Button size="sm" variant="destructive" onClick={() => decide(r.id, "rejected")}>Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
