import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Bug, Calendar } from "lucide-react";
import { format, isAfter } from "date-fns";

export const ParasiteTab = ({ petId }: { petId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["parasite", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parasite_preventatives")
        .select("*")
        .eq("pet_id", petId)
        .order("given_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("parasite_preventatives").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["parasite", petId] });
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-xl border-dashed border-hairline h-12 text-muted-foreground hover:text-foreground gap-2">
        <Plus className="h-4 w-4" /> Log parasite prevention
      </Button>
      {isLoading ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 h-20 animate-pulse" />
      ) : !data?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center text-sm text-muted-foreground">
          No flea/tick/worm prevention recorded
        </Card>
      ) : (
        data.map((p) => {
          const overdue = p.next_due_on && isAfter(new Date(), new Date(p.next_due_on));
          return (
            <Card key={p.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bug className="h-4 w-4 text-primary" />
                    <span className="font-medium">{p.product_name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{p.parasite_type}</Badge>
                    {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {format(new Date(p.given_on), "d MMM yyyy")}
                    {p.next_due_on && <> · next {format(new Date(p.next_due_on), "d MMM yyyy")}</>}
                  </div>
                  {p.batch_number && <div className="text-xs text-muted-foreground mt-1">Batch: {p.batch_number}</div>}
                  {p.notes && <p className="text-sm text-ink-soft mt-2">{p.notes}</p>}
                </div>
                <button onClick={() => del(p.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          );
        })
      )}
      <ParasiteDialog open={open} onOpenChange={setOpen} petId={petId} />
    </div>
  );
};

const ParasiteDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ product_name: "", parasite_type: "combination", given_on: today, next_due_on: "", batch_number: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_name.trim()) return toast.error("Product name required");
    setSaving(true);
    const { error } = await supabase.from("parasite_preventatives").insert({
      pet_id: petId,
      product_name: form.product_name.trim(),
      parasite_type: form.parasite_type as any,
      given_on: form.given_on,
      next_due_on: form.next_due_on || null,
      batch_number: form.batch_number.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["parasite", petId] });
    onOpenChange(false);
    setForm({ product_name: "", parasite_type: "combination", given_on: today, next_due_on: "", batch_number: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Parasite prevention</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Product" value={form.product_name} onChange={(v: string) => setForm({ ...form, product_name: v })} placeholder="NexGard, Bravecto…" />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Type</Label>
            <Select value={form.parasite_type} onValueChange={(v) => setForm({ ...form, parasite_type: v })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["flea", "tick", "heartworm", "dewormer", "combination", "other"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Given on" type="date" value={form.given_on} onChange={(v: string) => setForm({ ...form, given_on: v })} />
            <Field label="Next due" type="date" value={form.next_due_on} onChange={(v: string) => setForm({ ...form, next_due_on: v })} />
          </div>
          <Field label="Batch" value={form.batch_number} onChange={(v: string) => setForm({ ...form, batch_number: v })} />
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value, onChange, type = "text", ...rest }: any) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-11 rounded-xl border-hairline" {...rest} />
  </div>
);
