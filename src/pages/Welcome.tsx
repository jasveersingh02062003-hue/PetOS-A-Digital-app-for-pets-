import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, ShieldCheck, Users, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureSlide } from "@/components/welcome/FeatureSlide";
import { PetosLogo } from "@/components/PetosLogo";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";

const SLIDES = [
  {
    icon: Heart,
    title: "Your pet's whole life, in one app",
    copy: "Photos, friends, health records, and memories — all in one calm home.",
    accent: "hsl(var(--primary))",
  },
  {
    icon: Sparkles,
    title: "Petos AI, by your side",
    copy: "Ask anything about your pet. Symptoms, food, behaviour — answered with care, day or night.",
    accent: "hsl(var(--primary))",
  },
  {
    icon: ShieldCheck,
    title: "Vaccinations, never missed",
    copy: "We remind you 5 days before every booster is due. No more sticky notes on the fridge.",
    accent: "hsl(var(--primary))",
  },
  {
    icon: Users,
    title: "Mates, vets, sitters & shops",
    copy: "Find verified breeding partners, trusted vets, and pet-loving services near you.",
    accent: "hsl(var(--primary))",
  },
  {
    icon: MapPin,
    title: "If they go missing, the city helps",
    copy: "One tap alerts every Petos user nearby. Sightings come straight to your phone.",
    accent: "hsl(var(--primary))",
  },
];

const SEEN_KEY = "petos_seen_intro";

export default function Welcome() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  useSeo({
    title: "Welcome to Petos",
    description:
      "Photos, friends, health records, AI vet, mating, services and missing-pet alerts — one calm home for every pet.",
    jsonLd: [jsonLd.organization(), jsonLd.website()],
  });


  const finish = () => {
    localStorage.setItem(SEEN_KEY, "1");
    nav("/auth", { replace: true });
  };

  const next = () => (last ? finish() : setI(i + 1));

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pad-top-safe">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-4">
        <PetosLogo className="h-7" showPaw={true} />
        <button
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          Skip
        </button>
      </header>

      {/* Slide */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <FeatureSlide {...SLIDES[i]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + CTA */}
      <div className="px-6 pb-10 space-y-6">
        <div className="flex justify-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
        <Button
          onClick={next}
          className="w-full h-12 rounded-xl text-base font-medium"
          size="lg"
        >
          {last ? "Get started" : "Continue"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        {!last && (
          <p className="text-center text-xs text-muted-foreground -mt-3">
            Swipe or tap a dot to explore
          </p>
        )}
      </div>
    </div>
  );
}
