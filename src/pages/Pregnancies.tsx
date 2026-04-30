 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { useQuery, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { ArrowLeft, Baby, Loader2, Plus, Heart, CalendarDays } from "lucide-react";
 import { toast } from "sonner";
 import { format, differenceInDays } from "date-fns";
 
 const STATUS_TONE: Record<string, string> = {
   active: "bg-primary-soft text-primary border-0",
   whelped: "bg-emerald-100 text-emerald-700 border-0",
   lost: "bg-destructive/10 text-destructive border-0",
   cancelled: "bg-muted text-muted-foreground border-0",
 };
 
 const Pregnancies = () => {
   const nav = useNavigate();
   const { user } = useAuth();
   const qc = useQueryClient();
   const [open, setOpen] = useState(false);
   const [submitting, setSubmitting] = useState(false);
 
   const [damPetId, setDamPetId] = useState("");
   const [sirePetId, setSirePetId] = useState("");
   const [matingDate, setMatingDate] = useState("");
   const [expectedDate, setExpectedDate] = useState("");
   const [notes, setNotes] = useState("");
 
   const { data: pets } = useQuery({
     queryKey: ["my-female-pets", user?.id],
     enabled: !!user,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("pets")
         .select("id, name, gender, species, avatar_url")
         .eq("owner_id", user!.id);
       if (error) throw error;
       return data;
     },
   });
 
   const { data: pregnancies, isLoading } = useQuery({
     queryKey: ["pregnancies", user?.id],
     enabled: !!user,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("pregnancies")
         .select("*, dam:dam_pet_id(name, avatar_url, species), sire:sire_pet_id(name, avatar_url)")
         .eq("owner_id", user!.id)
         .order("created_at", { ascending: false });
       if (error) throw error;
       return data;
     },
   });
 
   const reset = () => {
     setDamPetId("");
     setSirePetId("");
     setMatingDate("");
     setExpectedDate("");
     setNotes("");
   };
 
   const create = async () => {
     if (!damPetId) {
       toast.error("Select the mother pet");
       return;
     }
     setSubmitting(true);
     const { error } = await supabase.from("pregnancies").insert({
       owner_id: user!.id,
       dam_pet_id: damPetId,
       sire_pet_id: sirePetId || null,
       mating_date: matingDate || null,
       expected_whelp_date: expectedDate || null,
       notes: notes || null,
     });
     setSubmitting(false);
     if (error) {
       toast.error(error.message);
       return;
     }
     toast.success("Pregnancy added");
     reset();
     setOpen(false);
     qc.invalidateQueries({ queryKey: ["pregnancies", user?.id] });
   };
 
   const setStatus = async (id: string, status: string) => {
     const patch: any = { status };
     if (status === "whelped") patch.actual_whelp_date = new Date().toISOString().slice(0, 10);
     const { error } = await supabase.from("pregnancies").update(patch).eq("id", id);
     if (error) {
       toast.error(error.message);
       return;
     }
     toast.success(`Marked ${status}`);
     qc.invalidateQueries({ queryKey: ["pregnancies", user?.id] });
   };
 
   const female = (pets || []).filter((p: any) => p.gender === "female");
 
   return (
     <div className="min-h-screen bg-background pb-24">
       <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
         <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <h1 className="text-lg font-semibold flex-1">Pregnancies</h1>
           <Dialog open={open} onOpenChange={setOpen}>
             <DialogTrigger asChild>
               <Button size="sm">
                 <Plus className="h-4 w-4 mr-1" />
                 New
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Track a new pregnancy</DialogTitle>
               </DialogHeader>
               <div className="space-y-3">
                 <div>
                   <Label>Mother (dam)</Label>
                   <Select value={damPetId} onValueChange={setDamPetId}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select your female pet" />
                     </SelectTrigger>
                     <SelectContent>
                       {female.length === 0 && (
                         <div className="p-2 text-sm text-muted-foreground">
                           No female pets found.
                         </div>
                       )}
                       {female.map((p: any) => (
                         <SelectItem key={p.id} value={p.id}>
                           {p.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label>Father (sire) — optional</Label>
                   <Select value={sirePetId} onValueChange={setSirePetId}>
                     <SelectTrigger>
                       <SelectValue placeholder="If you also own the sire" />
                     </SelectTrigger>
                     <SelectContent>
                       {(pets || [])
                         .filter((p: any) => p.gender === "male")
                         .map((p: any) => (
                           <SelectItem key={p.id} value={p.id}>
                             {p.name}
                           </SelectItem>
                         ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <Label>Mating date</Label>
                     <Input
                       type="date"
                       value={matingDate}
                       onChange={(e) => setMatingDate(e.target.value)}
                     />
                   </div>
                   <div>
                     <Label>Expected whelp</Label>
                     <Input
                       type="date"
                       value={expectedDate}
                       onChange={(e) => setExpectedDate(e.target.value)}
                     />
                   </div>
                 </div>
                 <p className="text-xs text-muted-foreground">
                   Tip: leave expected blank — we'll auto-set it 63 days after mating (typical
                   canine gestation).
                 </p>
                 <div>
                   <Label>Notes</Label>
                   <Textarea
                     value={notes}
                     onChange={(e) => setNotes(e.target.value)}
                     placeholder="Any context (vet, sire details, plan...)"
                   />
                 </div>
                 <Button onClick={create} disabled={submitting} className="w-full">
                   {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save pregnancy"}
                 </Button>
               </div>
             </DialogContent>
           </Dialog>
         </div>
       </header>
 
       <main className="container max-w-2xl mx-auto px-4 pt-4 space-y-3">
         {isLoading && (
           <div className="flex items-center justify-center py-12">
             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
           </div>
         )}
 
         {!isLoading && (pregnancies?.length ?? 0) === 0 && (
           <Card className="p-8 text-center">
             <Baby className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
             <h2 className="font-semibold mb-1">No pregnancies tracked</h2>
             <p className="text-sm text-muted-foreground mb-4">
               Track gestation week-by-week, log vet checks, and get a reminder before whelping
               day.
             </p>
             <Button onClick={() => setOpen(true)}>
               <Plus className="h-4 w-4 mr-1" />
               Track first pregnancy
             </Button>
           </Card>
         )}
 
         {pregnancies?.map((p: any) => {
           const expected = p.expected_whelp_date ? new Date(p.expected_whelp_date) : null;
           const daysLeft = expected ? differenceInDays(expected, new Date()) : null;
           const matedOn = p.mating_date ? new Date(p.mating_date) : null;
           const weekNum = matedOn
             ? Math.min(9, Math.max(1, Math.floor(differenceInDays(new Date(), matedOn) / 7) + 1))
             : null;
           return (
             <Card key={p.id} className="p-4">
               <div className="flex items-start gap-3">
                 <div className="h-12 w-12 rounded-full bg-primary-soft flex items-center justify-center overflow-hidden">
                   {p.dam?.avatar_url ? (
                     <img src={p.dam.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                   ) : (
                     <Heart className="h-6 w-6 text-primary" />
                   )}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     <p className="font-semibold">{p.dam?.name || "Pet"}</p>
                     <Badge className={STATUS_TONE[p.status]}>{p.status}</Badge>
                     {p.status === "active" && weekNum && (
                       <Badge variant="outline">Week {weekNum}</Badge>
                     )}
                   </div>
                   {p.sire?.name && (
                     <p className="text-xs text-muted-foreground">Sire: {p.sire.name}</p>
                   )}
                   {expected && (
                     <div className="flex items-center gap-1 text-sm mt-1">
                       <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                       <span>Expected {format(expected, "dd MMM yyyy")}</span>
                       {p.status === "active" && daysLeft !== null && (
                         <span
                           className={`ml-1 text-xs ${daysLeft <= 3 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}
                         >
                           {daysLeft >= 0 ? `(${daysLeft}d left)` : `(overdue ${-daysLeft}d)`}
                         </span>
                       )}
                     </div>
                   )}
                   {p.notes && <p className="text-sm mt-2 text-muted-foreground">{p.notes}</p>}
 
                   {p.status === "active" && (
                     <div className="flex gap-2 mt-3">
                       <Button size="sm" onClick={() => setStatus(p.id, "whelped")}>
                         Mark whelped
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => setStatus(p.id, "lost")}
                       >
                         Lost
                       </Button>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => setStatus(p.id, "cancelled")}
                       >
                         Cancel
                       </Button>
                     </div>
                   )}
                 </div>
               </div>
             </Card>
           );
         })}
       </main>
     </div>
   );
 };
 
 export default Pregnancies;