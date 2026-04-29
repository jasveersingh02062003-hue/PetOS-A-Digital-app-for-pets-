import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, AlertCircle, Syringe, FileText } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
}

/**
 * Inline read-only vet view of a pet's health vault, fetched via the
 * `vault-view` edge function using the owner-issued share code. Mirrors
 * `/v/:code` (VaultView page) but renders inside the AppointmentRoom so the
 * vet never has to leave the call.
 */
export const SharedVaultPanel = ({ open, onOpenChange, code }: Props) => {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !code) return;
    setState("loading");
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vault-view?code=${encodeURIComponent(code)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed");
          setState("error");
          return;
        }
        setData(json);
        setState("ok");
      } catch (e: any) {
        setError(e?.message || "Network error");
        setState("error");
      }
    })();
  }, [open, code]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Shared health vault
          </SheetTitle>
        </SheetHeader>

        {state === "loading" && (
          <div className="py-12 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {state === "error" && (
          <Card className="rounded-2xl border-hairline p-6 text-center mt-6">
            <AlertCircle className="h-7 w-7 mx-auto text-destructive mb-2" />
            <div className="font-medium">Access denied</div>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </Card>
        )}

        {state === "ok" && data && (
          <div className="space-y-4 mt-4">
            <div>
              <div className="font-display text-2xl">{data.pet?.name}</div>
              <div className="text-xs text-muted-foreground">
                {[data.pet?.breed, data.pet?.species].filter(Boolean).join(" · ")}
              </div>
              <Badge variant="secondary" className="mt-2 bg-primary-soft text-primary border-0">
                Read-only · expires{" "}
                {data.grant?.expires_at ? format(new Date(data.grant.expires_at), "d MMM, h:mm a") : "—"}
              </Badge>
            </div>

            {Array.isArray(data.vaccinations) && data.vaccinations.length > 0 && (
              <Card className="rounded-2xl border-hairline p-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                  <Syringe className="h-4 w-4 text-primary" /> Vaccinations
                </div>
                <ul className="space-y-1">
                  {data.vaccinations.map((v: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between gap-2">
                      <span className="font-medium">{v.vaccine_name || v.name}</span>
                      <span className="text-muted-foreground">
                        {v.administered_on ? format(new Date(v.administered_on), "d MMM yyyy") : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {Array.isArray(data.records) && data.records.length > 0 && (
              <Card className="rounded-2xl border-hairline p-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-primary" /> Records
                </div>
                <ul className="space-y-1">
                  {data.records.slice(0, 12).map((r: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between gap-2">
                      <span className="font-medium truncate">{r.title || r.kind}</span>
                      <span className="text-muted-foreground shrink-0">
                        {r.created_at ? format(new Date(r.created_at), "d MMM") : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default SharedVaultPanel;