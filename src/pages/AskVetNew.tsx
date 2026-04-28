import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateVetQuestion, type VetCategory } from "@/hooks/useAskVet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const AskVetNew = () => {
  const nav = useNavigate();
  const create = useCreateVetQuestion();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<VetCategory>("medical");

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    const q = await create.mutateAsync({ title: title.trim(), body: body.trim(), category });
    nav(`/askvet/${q.id}`);
  };

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-2xl">Ask a vet</h1>
      </header>

      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Why is my dog scratching her ear?" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as VetCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="medical">Medical</SelectItem>
              <SelectItem value="behavior">Behavior</SelectItem>
              <SelectItem value="nutrition">Nutrition</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Details</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe what you're seeing, when it started, and any context that might help…" rows={6} />
        </div>
        <Button onClick={submit} disabled={create.isPending || !title.trim() || !body.trim()} className="w-full rounded-full">
          {create.isPending ? "Posting…" : "Post question"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Public answers from verified vets · Not a substitute for emergency care
        </p>
      </div>
    </div>
  );
};

export default AskVetNew;
