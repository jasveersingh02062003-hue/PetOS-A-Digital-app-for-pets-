import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

type Partner = any;
type Lead = any;

export function InsuranceTab() {
  return (
    <div className="space-y-4">
      <KpiStrip />
      <Tabs defaultValue="leads">
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="leads" className="rounded-lg">Leads</TabsTrigger>
          <TabsTrigger value="partners" className="rounded-lg">Partners</TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="mt-4"><LeadsPanel /></TabsContent>
        <TabsContent value="partners" className="mt-4"><PartnersPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiStrip() {
  const [stats, setStats] = useState<{ leads: number; purchased: number; commission: number } | null>(null);
  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("insurance_leads")
        .select("status,commission_inr,created_at")
        .gte("created_at", since.toISOString());
      const rows = data ?? [];
      const purchased = rows.filter((r: any) => r.status === "purchased").length;
      const commission = rows.reduce((s: number, r: any) => s + (r.commission_inr ?? 0), 0);
      setStats({ leads: rows.length, purchased, commission });
    })();
  }, []);
  if (!stats) return null;
  const conv = stats.leads ? Math.round((stats.purchased / stats.leads) * 100) : 0;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card className="p-3 rounded-xl border-hairline shadow-none"><div className="text-[11px] text-muted-foreground">Leads (30d)</div><div className="font-display text-xl">{stats.leads}</div></Card>
      <Card className="p-3 rounded-xl border-hairline shadow-none"><div className="text-[11px] text-muted-foreground">Conversion</div><div className="font-display text-xl">{conv}%</div></Card>
      <Card className="p-3 rounded-xl border-hairline shadow-none"><div className="text-[11px] text-muted-foreground">Commission</div><div className="font-display text-xl">₹{stats.commission}</div></Card>
    </div>
  );
}

function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("insurance_leads").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter as any);
    const { data } = await q;
    setLeads(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const updateLead = async (id: string, patch: any) => {
    const { error } = await supabase.from("insurance_leads").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead updated");
    load();
  };

  if (loading) return <div className="grid place-items-center py-10"><Loader2 className="animate-spin h-5 w-5" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="purchased">Purchased</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {leads.length === 0 && <div className="text-sm text-muted-foreground">No leads.</div>}
      {leads.map((l) => (
        <Card key={l.id} className="p-3 rounded-xl border-hairline shadow-none">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{l.pet_breed_snapshot ?? "—"} · {l.pet_age_months_snapshot ?? "?"}mo</div>
              <div className="text-[11px] text-muted-foreground font-mono">{l.id.slice(0, 8)} · pet {l.pet_id.slice(0, 6)}</div>
            </div>
            <Badge variant="secondary" className="bg-muted">{l.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Select defaultValue={l.status} onValueChange={(v) => updateLead(l.id, { status: v })}>
              <SelectTrigger className="rounded-lg h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="purchased">Purchased</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Premium ₹"
              defaultValue={l.premium_inr ?? ""}
              onBlur={(e) => {
                const v = e.target.value ? parseInt(e.target.value, 10) : null;
                if (v !== l.premium_inr) updateLead(l.id, { premium_inr: v });
              }}
              className="rounded-lg h-9"
            />
            <Input
              placeholder="Partner ref"
              defaultValue={l.partner_ref ?? ""}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== l.partner_ref) updateLead(l.id, { partner_ref: v });
              }}
              className="rounded-lg h-9"
            />
          </div>
          {l.commission_inr ? (
            <div className="text-[11px] text-muted-foreground">Commission: ₹{l.commission_inr}</div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function PartnersPanel() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("insurance_partners").select("*").order("sort_order", { ascending: true });
    setPartners(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.redirect_url) { toast.error("Name and redirect URL required"); return; }
    const payload = {
      name: editing.name,
      logo_url: editing.logo_url || null,
      blurb: editing.blurb || null,
      country: editing.country || "IN",
      plan_min_inr: editing.plan_min_inr ? parseInt(editing.plan_min_inr, 10) : null,
      plan_max_inr: editing.plan_max_inr ? parseInt(editing.plan_max_inr, 10) : null,
      redirect_url: editing.redirect_url,
      commission_pct: editing.commission_pct ? parseFloat(editing.commission_pct) : 0,
      active: !!editing.active,
      sort_order: editing.sort_order ? parseInt(editing.sort_order, 10) : 100,
    };
    const q = editing.id
      ? supabase.from("insurance_partners").update(payload).eq("id", editing.id)
      : supabase.from("insurance_partners").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const toggleActive = async (p: Partner) => {
    await supabase.from("insurance_partners").update({ active: !p.active }).eq("id", p.id);
    load();
  };

  if (loading) return <div className="grid place-items-center py-10"><Loader2 className="animate-spin h-5 w-5" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="rounded-full gap-1" onClick={() => setEditing({ active: false, country: "IN" })}>
          <Plus className="h-4 w-4" /> Add partner
        </Button>
      </div>

      {partners.map((p) => (
        <Card key={p.id} className="p-3 rounded-xl border-hairline shadow-none flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{p.name} <span className="text-[11px] text-muted-foreground">· {p.commission_pct}%</span></div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">{p.blurb}</div>
          </div>
          <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(p)}>Edit</Button>
        </Card>
      ))}

      {editing && (
        <Card className="p-4 rounded-xl border-hairline shadow-none space-y-2">
          <div className="font-medium text-sm mb-1">{editing.id ? "Edit partner" : "New partner"}</div>
          <Input placeholder="Name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <Input placeholder="Logo URL" value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} />
          <Textarea placeholder="Blurb" value={editing.blurb ?? ""} onChange={(e) => setEditing({ ...editing, blurb: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Min ₹/yr" value={editing.plan_min_inr ?? ""} onChange={(e) => setEditing({ ...editing, plan_min_inr: e.target.value })} />
            <Input type="number" placeholder="Max ₹/yr" value={editing.plan_max_inr ?? ""} onChange={(e) => setEditing({ ...editing, plan_max_inr: e.target.value })} />
          </div>
          <Input placeholder="Redirect URL (use {lead_id})" value={editing.redirect_url ?? ""} onChange={(e) => setEditing({ ...editing, redirect_url: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.01" placeholder="Commission %" value={editing.commission_pct ?? ""} onChange={(e) => setEditing({ ...editing, commission_pct: e.target.value })} />
            <Input type="number" placeholder="Sort order" value={editing.sort_order ?? ""} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" className="gap-1" onClick={save}><Save className="h-4 w-4" />Save</Button>
          </div>
        </Card>
      )}
    </div>
  );
}