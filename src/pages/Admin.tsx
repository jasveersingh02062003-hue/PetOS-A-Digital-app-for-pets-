import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ShieldCheck, Stethoscope, Flag, Users } from "lucide-react";
import { toast } from "sonner";

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
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-muted rounded-xl">
            <TabsTrigger value="reports" className="rounded-lg gap-1.5"><Flag className="h-3.5 w-3.5" />Reports</TabsTrigger>
            <TabsTrigger value="vets" className="rounded-lg gap-1.5"><Stethoscope className="h-3.5 w-3.5" />Vets</TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg gap-1.5"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
          <TabsContent value="vets" className="mt-4"><VetAppsTab /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
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

export default Admin;
