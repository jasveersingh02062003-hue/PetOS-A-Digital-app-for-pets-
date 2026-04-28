import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollows";
import { UserPlus, UserCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { useState } from "react";

export const FollowButton = ({ targetId, size = "sm" }: { targetId: string; size?: "sm" | "default" }) => {
  const { user } = useAuth();
  const { data: isFollowing } = useIsFollowing(targetId);
  const toggle = useToggleFollow();
  const [burstKey, setBurstKey] = useState(0);

  if (!user || user.id === targetId) return null;

  return (
    <div className="relative">
      <Button
        size={size}
        variant={isFollowing ? "outline" : "default"}
        onClick={(e) => {
          e.stopPropagation();
          haptic(10);
          if (!isFollowing) setBurstKey((k) => k + 1);
          toggle.mutate({ targetId, isFollowing: !!isFollowing });
        }}
        disabled={toggle.isPending}
        className="rounded-full overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isFollowing ? (
            <motion.span
              key="following"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center"
            >
              <UserCheck className="h-4 w-4 mr-1.5" /> Following
            </motion.span>
          ) : (
            <motion.span
              key="follow"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center"
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Follow
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
      {/* Confetti dots on follow */}
      {burstKey > 0 && (
        <span key={burstKey} className="pointer-events-none absolute inset-0">
          {[-1, 0, 1].map((i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -16 - Math.abs(i) * 4, x: i * 10, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="absolute left-1/2 top-1 h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--primary))" }}
            />
          ))}
        </span>
      )}
    </div>
  );
};
