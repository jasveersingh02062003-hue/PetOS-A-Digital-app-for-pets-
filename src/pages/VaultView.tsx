import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, AlertCircle, Syringe, FileText, Activity, Utensils } from "lucide-react";
import { format } from "date-fns";

const VaultView = () => {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vault-view?code=${encodeURIComponent(code || "")}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Failed"); setState("error"); return; }
        setData(json); setState("ok");
      } catch (e: any) {
        setError(e.message || "Network error"); setState("error");
      }
    })();
  }, [code]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="rounded-2xl border-hairline p-8 text-center max-w-sm">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
          <div className="font-display text-xl mb-1">Access denied</div>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  const { pet, grant, vaccinations, records, symptoms, nutrition } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container-app py-8 space-y-6">
        <div className="text-center">
          <Badge variant="secondary" className="bg-primary-soft text-primary border-0 mb-3">Read-only vet view</Badge>
          <div className="font-display text-3xl">{pet?.name}</div>
          <div className="text-sm text-muted-foreground mt-1">{[pet?.breed, pet?.species].filter(Boolean).join(" · ")}</div>
          <div className="text-xs text-muted-foreground mt-2">Expires {format(new Date(grant.expires_at), "d MMM, h:mm a")}</div>
        </div>

        {pet?.vaccination_verified && (
          <Card className="rounded-2xl border-hairline p-4 flex items-center gap-3 bg-primary-soft border-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Vaccinations verified</span>
          </Card>
        )}

        <Section icon={Syringe} title="Vaccinations" empty="No vaccinations recorded">
          {vaccinations.map((v: any) => (
            <Card key={v.id} className="rounded-2xl border-hairline p-4">
              <div className="font-medium">{v.vaccine_name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(v.administered_on), "d MMM yyyy")}
                {v.next_due_on && <> · next {format(new Date(v.next_due_on), "d MMM yyyy")}</>}
              </div>
              {v.vet_name && <div className="text-xs text-muted-foreground mt-1">Vet: {v.vet_name}</div>}
            </Card>
          ))}
        </Section>

        <Section icon={FileText} title="Records" empty="No records">
          {records.map((r: any) => (
            <Card key={r.id} className="rounded-2xl border-hairline p-4">
              <div className="flex items-center gap-2">
                <div className="font-medium">{r.title}</div>
                <Badge variant="secondary" className="text-[10px] uppercase">{r.record_type}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{format(new Date(r.occurred_on), "d MMM yyyy")}</div>
              {r.notes && <p className="text-sm mt-2 text-ink-soft">{r.notes}</p>}
            </Card>
          ))}
        </Section>

        <Section icon={Activity} title="Recent symptoms" empty="No symptoms logged">
          {symptoms.map((s: any) => (
            <Card key={s.id} className="rounded-2xl border-hairline p-4">
              <div className="font-medium">{s.symptom} <span className="text-xs text-muted-foreground">· severity {s.severity}/5</span></div>
              <div className="text-xs text-muted-foreground mt-1">{format(new Date(s.logged_at), "d MMM, h:mm a")}</div>
              {s.notes && <p className="text-sm mt-2 text-ink-soft">{s.notes}</p>}
            </Card>
          ))}
        </Section>

        <Section icon={Utensils} title="Recent meals" empty="No meals logged">
          {nutrition.map((n: any) => (
            <Card key={n.id} className="rounded-2xl border-hairline p-4">
              <div className="font-medium">{n.food}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {n.portion && <>{n.portion} · </>}{format(new Date(n.fed_at), "d MMM, h:mm a")}
              </div>
            </Card>
          ))}
        </Section>
      </div>
    </div>
  );
};

const Section = ({ icon: Icon, title, empty, children }: { icon: any; title: string; empty: string; children: any }) => {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.filter(Boolean).length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      {hasItems ? <div className="space-y-2">{children}</div> : (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">{empty}</Card>
      )}
    </div>
  );
};

export default VaultView;
