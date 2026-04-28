import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { AiCoach } from "@/components/onboarding/AiCoach";

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  hero?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
  showCoach?: boolean;
};

export const StepShell = ({
  step, total, title, subtitle, hero, children,
  onBack, onNext, nextLabel = "Continue", nextDisabled, loading,
  canSkip, onSkip, showCoach = true,
}: Props) => (
  <div className="min-h-[100dvh] bg-background flex flex-col">
    {showCoach && <AiCoach step={step} />}
    {/* Top bar */}
    <header className="container-app pt-4 pb-2 flex items-center gap-3">
      {onBack ? (
        <Button variant="ghost" size="icon" className="rounded-full -ml-2" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : <div className="w-10" />}
      <div className="flex-1 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
      {canSkip ? (
        <button
          onClick={onSkip}
          className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      ) : <div className="w-10" />}
    </header>

    {/* Content */}
    <main className="container-app flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col"
        >
          {hero && (
            <div className="my-4 rounded-3xl overflow-hidden bg-muted/40 aspect-[5/3]">
              {hero}
            </div>
          )}
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Step {step + 1} of {total}
          </div>
          <h1 className="font-display text-3xl leading-tight mt-2">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
              {subtitle}
            </p>
          )}
          <div className="mt-6 flex-1">{children}</div>
        </motion.div>
      </AnimatePresence>
    </main>

    {/* CTA */}
    <footer className="container-app sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 pt-4 pb-6">
      <Button
        onClick={onNext}
        disabled={nextDisabled || loading}
        size="lg"
        className="w-full rounded-xl h-12 group"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </footer>
  </div>
);
