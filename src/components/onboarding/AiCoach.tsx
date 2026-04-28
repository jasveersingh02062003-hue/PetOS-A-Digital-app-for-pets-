import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, X, HelpCircle } from "lucide-react";

const COACH_MESSAGES: Record<number, string> = {
  0: "Hi, I'm Petos AI. I'll be helping you set things up — every answer makes me better at caring for your pet.",
  1: "I use your city to find nearby vets and your language to reply in your tongue.",
  2: "A clear photo and breed help me spot breed-specific health risks early.",
  3: "Weight and diet let me catch unsafe food recommendations before you see them.",
  4: "Personality helps me match you with compatible mates, sitters and dog parks.",
  5: "Goals shape your home feed and the tips I surface first.",
  6: "A vaccination certificate unlocks the verified badge and mating discoverability.",
};

interface AiCoachProps {
  step: number;
}

export const AiCoach = ({ step }: AiCoachProps) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [seenSteps, setSeenSteps] = useState<Set<number>>(new Set());

  // Auto-open on entering a new step; auto-collapse after 6s the first time
  useEffect(() => {
    setOpen(true);
    if (seenSteps.has(step)) return;
    setSeenSteps((s) => new Set(s).add(step));
    const t = setTimeout(() => setOpen(false), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const message = COACH_MESSAGES[step];
  if (!message) return null;

  return (
    <div className="fixed top-3 right-3 z-50 max-w-[280px] pointer-events-none">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="card"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 30, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto bg-card border border-hairline rounded-2xl shadow-lg p-3 pr-2"
          >
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-primary font-medium mb-0.5">
                  Petos AI
                </div>
                <p className="text-xs leading-relaxed text-foreground">{message}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="pill"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(true)}
            className="pointer-events-auto h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Open Petos AI tip"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
