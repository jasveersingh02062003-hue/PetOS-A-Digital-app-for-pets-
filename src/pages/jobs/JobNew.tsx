import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { useSeo } from "@/hooks/useSeo";

const HIDDEN = ["vet_clinic"];

const JobNew = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  useSeo({ title: "Post a job", description: "Hire a verified pet-care provider." });

  const [category, setCategory] = useState<string>("walking");
  const [petId, setPetId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("60");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");

  const { data: pets } = useQuery({
    queryKey: ["my-pets-min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id, name").eq("owner_id", user!.id);
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!title || !scheduledAt) throw new Error("Title and time are required");
      const { data, error } = await (supabase.from("job_posts" as any) as any).insert({
        owner_id: user.id,
        pet_id: petId || null,
        category,
        title,
        description: desc || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: parseInt(duration) || 60,
        address: address || null,
        budget_inr: budget ? parseInt(budget) : null,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Posted — providers nearby will be notified");
      nav(`/jobs/${id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not post"),
  });

  const cats = SERVICE_CATEGORIES.filter((c) => !HIDDEN.includes(c.key));

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-xl">Post a job</h1>
      </header>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Pet (optional)</Label>
          <Select value={petId} onValueChange={setPetId}>
            <SelectTrigger><SelectValue placeholder="Select a pet" /></SelectTrigger>
            <SelectContent>
              {pets?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Short title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Evening walk for my Lab" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>When</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address / area</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Budget (₹, optional)</Label>
          <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <Button className="w-full rounded-full h-12" onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post job"}
        </Button>
      </div>
    </div>
  );
};

export default JobNew;