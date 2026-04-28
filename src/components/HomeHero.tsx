import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Syringe, Camera, CalendarDays, Sparkles } from "lucide-react";
import { useProfile, usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type HeroAction = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  to: string;
  icon: any;
  tone: "primary" | "warning" | "info";
};

export const HomeHero = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();

  // Lightweight signals: post count + next-due vaccination
  const { data: signals } = useQuery({
    queryKey: ["home-hero-signals", user?.id, pets?.[0]?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const out: { posts: number; nextVaxDue: string | null; nextVaxName: string | null } = {
        posts: 0,
        nextVaxDue: null,
        nextVaxName: null,
      };
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user!.id);
      out.posts = count ?? 0;

      if (pets && pets.length > 0) {
        const { data: vax } = await supabase
          .from("vaccinations")
          .select("name, next_due_date")
          .in("pet_id", pets.map((p) => p.id))
          .not("next_due_date", "is", null)
          .order("next_due_date", { ascending: true })
          .limit(1);
        if (vax && vax[0]) {
          out.nextVaxDue = vax[0].next_due_date as string;
          out.nextVaxName = vax[0].name as string;
        }
      }
      return out;
    },
  });

  const action: HeroAction = (() => {
    if (!profile?.onboarded) {
      return {
        eyebrow: "Welcome",
        title: "Finish setting up Petos",
        body: "Add your name and city so others can find you.",
        cta: "Complete profile",
        to: "/onboarding",
        icon: Sparkles,
        tone: "primary",
      };
    }
    if (!pets || pets.length === 0) {
      return {
        eyebrow: "Get started",
        title: "Add your first pet",
        body: "Their photo, breed and birthday — all in 30 seconds.",
        cta: "Add a pet",
        to: "/pets/new",
        icon: Plus,
        tone: "primary",
      };
    }
    if (signals?.nextVaxDue) {
      const due = new Date(signals.nextVaxDue);
      const days = Math.ceil((+due - Date.now()) / 86400000);
      if (days <= 30) {
        return {
          eyebrow: days < 0 ? "Overdue" : "Upcoming",
          title: `${signals.nextVaxName} ${days < 0 ? "is overdue" : `due in ${days} day${days === 1 ? "" : "s"}`}`,
          body: `Keep ${pets[0].name}'s vaccination record up to date.`,
          cta: "Open health vault",
          to: "/health",
          icon: Syringe,
          tone: days < 0 ? "warning" : "info",
        };
      }
    }
    if ((signals?.posts ?? 0) === 0) {
      return {
        eyebrow: "Your turn",
        title: `Share ${pets[0].name}'s first moment`,
        body: "Photos, hashtags, daily streaks — your pet's story starts here.",
        cta: "Open composer",
        to: "/?compose=1",
        icon: Camera,
        tone: "primary",
      };
    }
    if (!profile?.city) {
      return {
        eyebrow: "Discover locally",
        title: "Add your city",
        body: "We'll show meetups and pets around you.",
        cta: "Update profile",
        to: "/settings/profile",
        icon: CalendarDays,
        tone: "info",
      };
    }
    return {
      eyebrow: "This week",
      title: "Find a meetup near you",
      body: `See what's happening for pet parents in ${profile.city}.`,
      cta: "Browse meetups",
      to: "/meetups",
      icon: CalendarDays,
      tone: "info",
    };
  })();

  const Icon = action.icon;
  const toneClass =
    action.tone === "warning"
      ? "from-emergency/15 to-emergency/5 border-emergency/30"
      : action.tone === "info"
      ? "from-accent/15 to-accent/5 border-accent/30"
      : "from-primary/15 to-primary/5 border-primary/30";

  const onClick = () => {
    if (action.to === "/?compose=1") {
      window.dispatchEvent(new CustomEvent("petos:open-composer"));
      return;
    }
    nav(action.to);
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border bg-gradient-to-br ${toneClass} p-4 active:scale-[0.99] transition-transform mb-3`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-background/70 border border-hairline flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-foreground" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{action.eyebrow}</div>
          <div className="font-display text-base leading-tight mt-0.5">{action.title}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.body}</div>
          <div className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-foreground">
            {action.cta} <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
};
