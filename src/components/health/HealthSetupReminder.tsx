import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, X, ArrowRight } from "lucide-react";

/**
 * Surfaces pets whose owner deferred health-vault setup during onboarding
 * (`pets.health_setup_complete = false`).
 *
 * - `compact` variant: used on the Home screen. Dismissible per-pet (localStorage)
 *   so the user isn't nagged on every visit, but the prompt stays visible in the
 *   Health tab as the source of truth.
 * - `full` variant: used at the top of the Health vault. Non-dismissible — this
 *   is where the user is expected to actually complete setup.
 */
type Props = { variant: "compact" | "full" };

const DISMISS_KEY = "health-setup-dismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function HealthSetupReminder({ variant }: Props) {
  const nav = useNavigate();
  const { data: pets } = usePets();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (variant === "compact") setDismissed(readDismissed());
  }, [variant]);

  const incomplete = useMemo(() => {
    const list = (pets ?? []).filter((p: any) => p?.health_setup_complete === false);
    if (variant === "compact") return list.filter((p: any) => !dismissed.includes(p.id));
    return list;
  }, [pets, dismissed, variant]);

  if (!incomplete.length) return null;

  const dismiss = (petId: string) => {
    const next = [...dismissed, petId];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  if (variant === "compact") {
    const pet: any = incomplete[0];
    const more = incomplete.length - 1;
    return (
      <Card className="rounded-2xl p-3 mb-3 border-primary/30 bg-primary/5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 grid place-items-center shrink-0">
          <Heart className="h-4 w-4 text-primary" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            Finish health setup for {pet.name}
            {more > 0 ? ` +${more} more` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            Add vaccines & emergency vet — takes ~1 min
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-full h-8"
          onClick={() => nav("/health")}
        >
          Set up
        </Button>
        <button
          aria-label="Dismiss"
          onClick={() => dismiss(pet.id)}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      {incomplete.map((pet: any) => (
        <Card
          key={pet.id}
          className="rounded-2xl p-4 border-primary/30 bg-primary/5"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center shrink-0">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">Set up {pet.name}'s health vault</div>
              <div className="text-xs text-muted-foreground">
                Vaccines, weight, emergency vet — finish what you skipped
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => nav(`/settings/pet/${pet.id}`)}
            >
              Set up <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
