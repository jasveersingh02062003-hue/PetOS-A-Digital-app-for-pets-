import { motion } from "framer-motion";
import { Sparkles, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const PetCardShare = ({
  petName, species, breed, city, avatar, verified, onContinue,
}: {
  petName: string; species: string; breed: string; city: string;
  avatar?: string | null; verified: boolean; onContinue: () => void;
}) => (
  <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 py-10">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm"
    >
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4"
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </motion.div>
        <h1 className="font-display text-3xl">Welcome to Petos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Meet {petName}'s home — yours.
        </p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="rounded-3xl overflow-hidden bg-card border border-hairline shadow-xl"
      >
        <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
          {avatar ? (
            <img src={avatar} alt={petName} className="w-full h-full object-cover" />
          ) : (
            <div className="font-display text-7xl text-primary/40">{petName[0]?.toUpperCase()}</div>
          )}
        </div>
        <div className="p-5 space-y-1">
          <div className="flex items-center gap-2">
            <div className="font-display text-2xl">{petName}</div>
            {verified && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <Check className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground capitalize">{breed} · {species}</div>
          <div className="text-xs text-muted-foreground">{city}</div>
        </div>
      </motion.div>

      <div className="space-y-2 mt-8">
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-xl h-12 border-hairline gap-2"
          onClick={async () => {
            const text = `Meet ${petName} on Petos 🐾 — ${breed} from ${city}.`;
            const url = window.location.origin;
            try {
              if (navigator.share) {
                await navigator.share({ title: `${petName} on Petos`, text, url });
              } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
              }
            } catch { /* user cancelled */ }
          }}
        >
          <Share2 className="h-4 w-4" /> Share {petName}'s card
        </Button>
        <Button onClick={onContinue} size="lg" className="w-full rounded-xl h-12">
          Enter Petos
        </Button>
      </div>
    </motion.div>
  </div>
);
