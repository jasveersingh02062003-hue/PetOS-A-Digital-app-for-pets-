import { Link, useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Loader2, FileText } from "lucide-react";
 import { format } from "date-fns";
 
 const OrgDonations = () => {
   const nav = useNavigate();
   const { user } = useAuth();
 
   const { data: org } = useQuery({
     queryKey: ["my-org", user?.id],
     enabled: !!user,
     queryFn: async () => {
       const { data } = await supabase
         .from("org_profiles")
         .select("org_name, total_donations_inr, donor_count, status")
         .eq("user_id", user!.id)
         .maybeSingle();
       return data;
     },
   });
 
   const { data: donations, isLoading } = useQuery({
     queryKey: ["org-donations", user?.id],
     enabled: !!user,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("donations")
         .select("*, donor:donor_id(full_name, avatar_url)")
         .eq("org_user_id", user!.id)
         .in("status", ["paid", "beta_free"])
         .order("created_at", { ascending: false })
         .limit(200);
       if (error) throw error;
       return data;
     },
   });
 
   return (
     <div className="min-h-screen bg-background pb-24">
       <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
         <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <h1 className="text-lg font-semibold flex-1">Donations</h1>
         </div>
       </header>
 
       <main className="container max-w-2xl mx-auto px-4 pt-4 space-y-3">
         {!org && (
           <Card className="p-6 text-center text-muted-foreground">
             You don't have an organisation profile yet.
           </Card>
         )}
 
         {org && (
           <Card className="p-5 bg-gradient-to-br from-primary/10 to-coral/10 border-0">
             <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
               <Heart className="h-4 w-4 text-coral" /> Total raised on PetOS
             </div>
             <div className="font-display text-3xl">
               ₹{(org.total_donations_inr ?? 0).toLocaleString("en-IN")}
             </div>
             <div className="text-sm text-muted-foreground mt-1">
               from {org.donor_count ?? 0} donor{org.donor_count === 1 ? "" : "s"}
             </div>
           </Card>
         )}
 
         <h2 className="text-sm font-semibold text-muted-foreground mt-4">Recent</h2>
 
         {isLoading && (
           <div className="flex items-center justify-center py-10">
             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
           </div>
         )}
 
         {!isLoading && (donations?.length ?? 0) === 0 && (
           <Card className="p-6 text-center text-sm text-muted-foreground">
             No donations yet. Share your profile link to get started.
           </Card>
         )}
 
         {donations?.map((d: any) => (
           <Card key={d.id} className="p-3 flex items-start gap-3">
             <div className="h-10 w-10 rounded-full bg-primary-soft flex items-center justify-center text-sm font-medium overflow-hidden">
               {d.anonymous ? (
                 "?"
               ) : d.donor?.avatar_url ? (
                 <img
                   src={d.donor.avatar_url}
                   alt=""
                   className="h-full w-full object-cover"
                 />
               ) : (
                 (d.donor?.full_name || "U").slice(0, 1).toUpperCase()
               )}
             </div>
             <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2">
                 <span className="font-medium text-sm">
                   {d.anonymous ? "Anonymous" : d.donor?.full_name || "Donor"}
                 </span>
                 {d.status === "beta_free" && (
                   <Badge variant="outline" className="text-[10px]">
                     beta
                   </Badge>
                 )}
               </div>
               <div className="text-xs text-muted-foreground">
                 {format(new Date(d.created_at), "dd MMM yyyy, HH:mm")}
               </div>
               {d.message && (
                 <p className="text-sm mt-1 italic text-muted-foreground">
                   "{d.message}"
                 </p>
               )}
              {d.tax_receipt_number && (
                <Link
                  to={`/donations/${d.id}/receipt`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary mt-1.5 hover:underline"
                >
                  <FileText className="h-3 w-3" /> 80G receipt · {d.tax_receipt_number}
                </Link>
              )}
             </div>
             <div className="font-display text-lg text-coral">
               ₹{d.amount_inr.toLocaleString("en-IN")}
             </div>
           </Card>
         ))}
       </main>
     </div>
   );
 };
 
 export default OrgDonations;