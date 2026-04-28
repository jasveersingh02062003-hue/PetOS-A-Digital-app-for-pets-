import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureSlideProps {
  icon: LucideIcon;
  title: string;
  copy: string;
  accent?: string;
}

export const FeatureSlide = ({ icon: Icon, title, copy, accent = "hsl(var(--primary))" }: FeatureSlideProps) => (
  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10 relative"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        className="absolute inset-0 rounded-full"
        style={{ background: accent, opacity: 0.1, transform: "scale(1.5)" }}
      />
      <div
        className="relative h-32 w-32 rounded-full flex items-center justify-center"
        style={{ background: accent + "1f" }}
      >
        <Icon className="h-14 w-14" strokeWidth={1.4} style={{ color: accent }} />
      </div>
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="font-display text-3xl mb-4 leading-tight"
    >
      {title}
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="text-base text-muted-foreground leading-relaxed max-w-xs"
    >
      {copy}
    </motion.p>
  </div>
);
