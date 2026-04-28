import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-primary-soft text-primary border-0",
  paused: "bg-muted text-muted-foreground border-0",
  cancelled: "bg-destructive/10 text-destructive border-0",
};

const RecurringBookings = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["recurring-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bookings")
        .select(
          "*, providers:provider_id(name, category, cover_url), pets:pet_id(name, avatar_url)",
        )
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: "active" | "paused" | "cancelled") => {
    const { error } = await supabase
      .from("recurring_bookings")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Schedule ${status}`);
    qc.invalidateQueries({ queryKey: ["recurring-bookings", user?.id] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring schedule? Existing bookings remain.")) return;
    const { error } = await supabase.from("recurring_bookings").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["recurring-bookings", user?.id] });
  };

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Sign in to manage recurring bookings.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl font-semibold">Recurring bookings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (schedules?.length ?? 0) === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No recurring bookings yet.</p>
            <p className="text-sm mt-1">
              Set one up next time you book a service.
            </p>
          </Card>
        )}

        {schedules?.map((s: any) => (
          <Card key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{s.providers?.name ?? "Provider"}</p>
                  <Badge className={STATUS_TONE[s.status]}>{s.status}</Badge>
                </div>
                {s.providers?.category && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {s.providers.category}
                  </p>
                )}
                {s.pets?.name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    For {s.pets.name}
                  </p>
                )}
              </div>
            </div>

            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Frequency: </span>
                {FREQ_LABEL[s.frequency] ?? s.frequency}
              </p>
              <p>
                <span className="text-muted-foreground">Days: </span>
                {(s.weekdays as number[])?.map((d) => DAY_LABELS[d]).join(", ") || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Time: </span>
                {String(s.time_of_day).slice(0, 5)}
              </p>
              <p>
                <span className="text-muted-foreground">Starts: </span>
                {s.start_date}
                {s.end_date ? ` · ends ${s.end_date}` : ""}
              </p>
              {s.notes && (
                <p className="text-muted-foreground italic">"{s.notes}"</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              {s.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(s.id, "paused")}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              )}
              {s.status === "paused" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(s.id, "active")}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              )}
              {s.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(s.id, "cancelled")}
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive ml-auto"
                onClick={() => remove(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RecurringBookings;