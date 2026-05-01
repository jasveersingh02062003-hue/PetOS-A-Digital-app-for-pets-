import { Camera, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile, usePets } from "@/hooks/useProfile";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";

/**
 * Replaces an empty Story rail with a warm, personal prompt that opens the
 * story composer directly. Shows the pet's name when we know it — far more
 * inviting than a lone "+" tile that screams "no one is posting".
 *
 * Dispatches the same `petos:open-composer` event used everywhere so the
 * existing global Composer can handle it (no new wiring needed).
 */
export const SmartStoryPrompt = () => {
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const petName = pets?.[0]?.name;
  const petAvatar = pets?.[0]?.avatar_url ?? profile?.avatar_url ?? undefined;
  const ring = getRoleRing((profile?.account_type as any) ?? "pet_parent");

  const part = new Date().getHours() < 12
    ? "morning"
    : new Date().getHours() < 18
      ? "afternoon"
      : "evening";

  const headline = petName
    ? `Share ${petName}'s ${part}`
    : "Share a moment from today";

  const sub = petName
    ? "Your followers want to see what they're up to."
    : "Add your first pet to start sharing daily moments.";

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
      className={cn(
        "w-full text-left rounded-2xl border-hairline bg-card",
        "p-3 flex items-center gap-3 transition-all",
        "hover:bg-muted/40 active:scale-[0.99] animate-fade-in",
      )}
      aria-label={headline}
    >
      <div className="relative shrink-0">
        <Avatar className={cn("h-12 w-12 ring-2 ring-offset-2 ring-offset-background", ring)}>
          {petAvatar ? <AvatarImage src={petAvatar} alt={petName ?? "you"} /> : null}
          <AvatarFallback className="bg-primary-soft text-primary font-medium">
            {(petName ?? profile?.full_name ?? "·")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
          <Camera className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">{headline}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">{sub}</div>
      </div>
      <span className="text-xs font-medium text-primary shrink-0 pr-1">Add</span>
    </button>
  );
};

export default SmartStoryPrompt;
