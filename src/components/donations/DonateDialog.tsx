 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Checkbox } from "@/components/ui/checkbox";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { Heart, Loader2 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { toast } from "sonner";
 import { useNavigate } from "react-router-dom";
 
 const PRESETS = [100, 250, 500, 1000, 2500];
 
 export function DonateDialog({
   orgUserId,
   orgName,
   trigger,
 }: {
   orgUserId: string;
   orgName: string;
   trigger: React.ReactNode;
 }) {
   const { user } = useAuth();
   const nav = useNavigate();
   const [open, setOpen] = useState(false);
   const [amount, setAmount] = useState<number>(500);
   const [message, setMessage] = useState("");
   const [anonymous, setAnonymous] = useState(false);
   const [loading, setLoading] = useState(false);
 
   const submit = async () => {
     if (!user) {
       nav("/auth");
       return;
     }
     if (!amount || amount < 10) {
       toast.error("Minimum donation is ₹10");
       return;
     }
     setLoading(true);
     const { data, error } = await supabase.functions.invoke("create-donation-checkout", {
       body: {
         org_user_id: orgUserId,
         amount_inr: amount,
         message: message || undefined,
         anonymous,
       },
     });
     setLoading(false);
     if (error) {
       toast.error(error.message);
       return;
     }
     if (data?.status === "checkout" && data.url) {
       window.location.href = data.url;
       return;
     }
     if (data?.status === "beta_free") {
       toast.success(`Thank you! ₹${amount} recorded as a beta donation to ${orgName}`);
       setOpen(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={setOpen}>
       <DialogTrigger asChild>{trigger}</DialogTrigger>
       <DialogContent>
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Heart className="h-5 w-5 text-coral" /> Donate to {orgName}
           </DialogTitle>
         </DialogHeader>
         <div className="space-y-3">
           <div className="grid grid-cols-5 gap-2">
             {PRESETS.map((p) => (
               <button
                 key={p}
                 onClick={() => setAmount(p)}
                 className={`rounded-xl py-2 text-sm border ${amount === p ? "bg-coral text-white border-coral" : "border-hairline bg-card"}`}
               >
                 ₹{p}
               </button>
             ))}
           </div>
           <div>
             <Label>Amount (₹)</Label>
             <Input
               type="number"
               min={10}
               value={amount}
               onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
             />
           </div>
           <div>
             <Label>Message (optional)</Label>
             <Textarea
               value={message}
               maxLength={280}
               onChange={(e) => setMessage(e.target.value)}
               placeholder="Say something to the team"
             />
           </div>
           <label className="flex items-center gap-2 text-sm">
             <Checkbox
               checked={anonymous}
               onCheckedChange={(v) => setAnonymous(!!v)}
             />
             Donate anonymously
           </label>
           <Button
             onClick={submit}
             disabled={loading}
             className="w-full bg-coral hover:bg-coral/90 text-white"
           >
             {loading ? (
               <Loader2 className="h-4 w-4 animate-spin" />
             ) : (
               <>
                 <Heart className="h-4 w-4 mr-1" /> Donate ₹{amount}
               </>
             )}
           </Button>
           <p className="text-[11px] text-muted-foreground text-center">
             Secure checkout. You'll receive a receipt by email.
           </p>
         </div>
       </DialogContent>
     </Dialog>
   );
 }