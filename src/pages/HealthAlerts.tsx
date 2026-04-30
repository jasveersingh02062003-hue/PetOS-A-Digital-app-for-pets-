import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useHealthAlerts, HealthAlert } from "@/hooks/useHealthAlerts";
import { usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, ChevronLeft, CheckCheck, AlertTriangle, Activity, Info, Siren, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const sevIcon = (s: HealthAlert["severity"]) => {
  if (s === "emergency") return <Siren className="h-3.5 w-3.5" />;
  if (s === "action") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (s === "watch") return <Activity className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
};

const sevTone = (s: HealthAlert["severity"]) => {
  if (s === "emergency") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "action") return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (s === "watch") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-primary-soft text-primary border-primary/20";
};

const HealthAlertsPage = () => {
  const nav = useNavigate();
  const { alerts, unread, markRead, markAllRead, dismiss, isLoading } = useHealthAlerts();
  const { data: pets } = usePets();
  const [petFilter, setPetFilter] = useState<string | "all">("all");

  const filtered = useMemo(
    () => (petFilter === "all" ? alerts : alerts.filter((a) => a.pet_id === petFilter)),
    [alerts, petFilter],
  );

  const petName = (id: string | null) => pets?.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full -ml-2" onClick={() => nav(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Health alerts</h1>
        {unread.length > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1.5 rounded-full">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </header>

      {pets && pets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-4">
          <button
            onClick={() => setPetFilter("all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${petFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline"}`}
          >
            All
          </button>
          {pets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPetFilter(p.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${petFilter === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-6 animate-pulse h-24" />
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
          <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <div className="font-display text-lg">All clear</div>
          <p className="text-sm text-muted-foreground mt-1">
            No alerts{petFilter !== "all" ? " for this pet" : ""} right now.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  if (!a.read_at) markRead(a.id);
                  if (a.link) nav(a.link);
                }}
                className={`w-full text-left rounded-2xl border p-4 transition-colors ${sevTone(a.severity)} ${!a.read_at ? "" : "opacity-70"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{sevIcon(a.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-sm">{a.title}</div>
                      {a.pet_id && petName(a.pet_id) && (
                        <Badge variant="outline" className="text-[10px] border-current/30 bg-transparent">
                          {petName(a.pet_id)}
                        </Badge>
                      )}
                      {!a.read_at && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </div>
                    {a.body && <p className="text-xs opacity-90 mt-1 leading-relaxed">{a.body}</p>}
                    <div className="text-[10px] opacity-70 mt-1.5">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(a.id);
                    }}
                    className="opacity-50 hover:opacity-100 -mr-1 -mt-1 p-1"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HealthAlertsPage;
