import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import { Camera, Flame, ShieldCheck, Syringe, Sparkles, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, usePets } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

/**
 * The hero of the home screen: shows whose pet you're parenting,
 * an animated health ring, a streak chip, and the most relevant CTA.
 *
 * If the user has no pet yet → onboarding nudge instead.
 */
export const PetHeroCard = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();

  const pet = pets?.[0];

  const { data: signals } = useQuery({
    queryKey: ["pet-hero-signals", pet?.id, user?.id],
    enabled: !!pet?.id && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // Health-status view (already used by HealthStatusStrip)
      const [{ data: status }, { data: lastPost }] = await Promise.all([
        supabase.from("pet_health_status" as any).select("*").eq("pet_id", pet!.id).maybeSingle(),
        supabase.from("posts").select("created_at").eq("author_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { status: status as any, lastPost };
    },
  });

  // No pet yet — onboarding nudge
  if (!pet) {
    return (
      <button
        onClick={() => nav("/onboarding")}
        className="w-full text-left rounded-3xl p-5 mb-4 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground card-elev active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/15 grid place-items-center">
            <Sparkles className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">Welcome</div>
            <div className="font-display text-xl mt-0.5">Add your first pet</div>
            <div className="text-xs opacity-85 mt-1">30 seconds. Photo, breed, birthday — done.</div>
          </div>
        </div>
      </button>
    );
  }

  // Compute health score (mirrors HealthStatusStrip)
  const status = signals?.status;
  let score = 100;
  let nextHealthLabel: string | null = null;
  if (status) {
    if (!status.vaccination_verified) { score -= 20; nextHealthLabel = "Verify vaccinations"; }
    if (status.next_parasite_due) {
      const d = differenceInCalendarDays(new Date(status.next_parasite_due), new Date());
      if (d < 0) { score -= 15; nextHealthLabel = "Parasite overdue"; }
      else if (d <= 14 && !nextHealthLabel) nextHealthLabel = `Parasite in ${d}d`;
    }
    if (status.last_activity_on) {
      const d = differenceInCalendarDays(new Date(), new Date(status.last_activity_on));
      if (d > 2) score -= 10;
    }
  }
  score = Math.max(0, Math.min(100, score));

  // Color the ring by score
  const ringColor =
    score >= 80 ? "hsl(var(--leaf))"
    : score >= 60 ? "hsl(var(--amber))"
    : "hsl(var(--coral))";

  // Streak: posts in last 24h?
  const lastPostAt = signals?.lastPost?.created_at ? new Date(signals.lastPost.created_at) : null;
  const hoursSincePost = lastPostAt ? (Date.now() - +lastPostAt) / 3600_000 : Infinity;
  const onStreak = hoursSincePost < 30;

  // Compute age
  const dob = (pet as any).date_of_birth ? new Date((pet as any).date_of_birth) : null;
  const age = dob ? formatDistanceToNowStrict(dob, { unit: "month" }) : null;

  // Ring math
  const R = 30;
  const C = 2 * Math.PI * R;
  const dash = (score / 100) * C;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl bg-card card-elev p-4 mb-4 border border-hairline"
    >
      <div className="flex items-center gap-4">
        {/* Avatar with animated health ring */}
        <button
          onClick={() => nav("/health")}
          className="relative shrink-0 active:scale-95 transition-transform"
          aria-label={`${pet.name} health score ${score}`}
        >
          <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
            <circle cx="38" cy="38" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
            <motion.circle
              cx="38" cy="38" r={R} fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C - dash }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-1.5 rounded-full overflow-hidden bg-muted grid place-items-center">
            {pet.avatar_url ? (
              <img src={pet.avatar_url} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-2xl text-primary">{pet.name?.[0] ?? "·"}</span>
            )}
          </div>
          {/* Score chip */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold grid place-items-center min-w-[28px]">
            {score}
          </div>
        </button>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="font-display text-2xl leading-tight truncate">{pet.name}</div>
            {pet.vaccination_verified && (
              <span title="Verified" className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-sky/15">
                <ShieldCheck className="h-3 w-3 text-sky" strokeWidth={2.4} />
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {[pet.breed, age].filter(Boolean).join(" · ")}
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {onStreak && (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-amber/15 text-amber-foreground text-[11px] font-semibold">
                <Flame className="h-3 w-3 text-amber" /> On streak
              </span>
            )}
            {nextHealthLabel ? (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-coral/15 text-[11px] font-semibold text-coral">
                <Syringe className="h-3 w-3" /> {nextHealthLabel}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-leaf/15 text-[11px] font-semibold text-leaf">
                <Heart className="h-3 w-3" /> All good
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <HeroAction
          icon={Camera}
          label="Moment"
          tone="coral"
          onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
        />
        <HeroAction
          icon={Heart}
          label="Health"
          tone="amber"
          onClick={() => nav("/health")}
        />
        <HeroAction
          icon={Sparkles}
          label="Mates"
          tone="lilac"
          onClick={() => nav("/mates")}
        />
      </div>
    </motion.div>
  );
};

const TONE_CLASSES: Record<string, string> = {
  coral: "bg-coral/10 text-coral hover:bg-coral/15",
  amber: "bg-amber/10 text-amber-foreground hover:bg-amber/15",
  lilac: "bg-lilac/10 text-lilac hover:bg-lilac/15",
  sky: "bg-sky/10 text-sky hover:bg-sky/15",
  leaf: "bg-leaf/10 text-leaf hover:bg-leaf/15",
};

const HeroAction = ({
  icon: Icon, label, tone, onClick,
}: { icon: any; label: string; tone: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${TONE_CLASSES[tone]}`}
  >
    <Icon className="h-4 w-4" strokeWidth={2.2} />
    {label}
  </button>
);
