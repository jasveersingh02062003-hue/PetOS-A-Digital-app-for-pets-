import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Video, MapPin, Plus } from "lucide-react";

const modeIcon: Record<string, JSX.Element> = {
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  in_clinic: <MapPin className="h-3.5 w-3.5" />,
};

export default function MyAppointments() {
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: appts } = useQuery({
    queryKey: ["my-appts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("owner_id", user!.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((a) => a.pet_id)));
      const { data: pets } = await supabase.from("pets").select("id,name,avatar_url").in("id", ids);
      const map = new Map((pets || []).map((p) => [p.id, p]));
      return (data || []).map((a) => ({ ...a, pet: map.get(a.pet_id) }));
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl flex-1">My appointments</h1>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/book-vet"><Plus className="h-4 w-4 mr-1" />Book</Link>
        </Button>
      </header>

      <div className="p-4 space-y-3">
        {(appts?.length ?? 0) === 0 && (
          <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
            No appointments yet. Book a vet to get started.
          </Card>
        )}
        {appts?.map((a: any) => (
          <Card key={a.id} className="rounded-2xl border-hairline p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-display text-base">{a.pet?.name || "Pet"}</div>
                <div className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
                  {modeIcon[a.mode]}
                  <span className="capitalize">{a.mode.replace("_", " ")}</span>
                  <span>·</span>
                  <span>{new Date(a.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              </div>
              <Badge variant="secondary" className="capitalize">{a.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 pt-3 border-t border-hairline">
              <Button asChild size="sm" variant="outline" className="w-full rounded-full">
                <Link to={`/appointment/${a.id}`}>Open</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
