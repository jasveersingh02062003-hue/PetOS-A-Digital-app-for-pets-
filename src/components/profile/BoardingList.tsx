import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Trash2, Hotel } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["boarding", "daycare", "grooming", "training"] as const;

export const BoardingList = ({ userId, isOwner = false }: { userId: string; isOwner?: boolean }) => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", service_type: "boarding", price: "", city: "" });

  const { data: services, isLoading } = useQuery({
    queryKey: ["boarding-services", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("boarding_services")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    const { error } = await supabase.from("boarding_services").insert({
      owner_id: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      service_type: form.service_type,
      price_inr_per_day: form.price ? parseInt(form.price, 10) : null,
      city: form.city.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Service added");
    setForm({ title: "", description: "", service_type: "boarding", price: "", city: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["boarding-services", userId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("boarding_services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["boarding-services", userId] });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;

  const visible = (services ?? []).filter((s: any) => s.active || isOwner);

  return (
    <div className="space-y-3">
      {isOwner && !adding && (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full rounded-xl border-dashed border-hairline gap-2">
          <Plus className="h-4 w-4" /> Add a service
        </Button>
      )}

      {isOwner && adding && (
        <Card className="rounded-2xl border-hairline p-3 space-y-2">
          <Input placeholder="Title (e.g. Cozy boarding for small dogs)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background text-sm px-3"
              value={form.service_type}
              onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input type="number" placeholder="₹ per day" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={submit} className="flex-1 rounded-xl">Save</Button>
            <Button variant="outline" onClick={() => setAdding(false)} className="rounded-xl">Cancel</Button>
          </div>
        </Card>
      )}

      {!visible.length && !adding && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          <Hotel className="h-6 w-6 mx-auto mb-2 opacity-50" />
          No services listed.
        </div>
      )}

      {visible.map((s: any) => (
        <Card key={s.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="font-medium truncate">{s.title}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{s.service_type}</div>
            </div>
            {s.price_inr_per_day && (
              <div className="text-sm font-semibold text-primary shrink-0">
                ₹{s.price_inr_per_day.toLocaleString("en-IN")}
                <span className="text-[10px] text-muted-foreground font-normal">/day</span>
              </div>
            )}
          </div>
          {s.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.description}</p>}
          <div className="flex items-center justify-between mt-2">
            {s.city && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city}</span>}
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="h-7 px-2 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};