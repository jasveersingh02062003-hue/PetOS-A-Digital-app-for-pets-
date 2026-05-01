import { useRef } from "react";

/**
 * Lightweight, dependency-free swipe handler for touch devices.
 *
 * - Detects horizontal/vertical swipes with configurable thresholds.
 * - Ignores ambiguous gestures (must travel mostly along one axis).
 * - Does NOT preventDefault — vertical scroll keeps working naturally.
 *
 * Use it for "save on swipe right" / "next on swipe left" / "open
 * comments on swipe up" patterns on post cards.
 */
type Handlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
};

export const useSwipe = (handlers: Handlers, threshold = 60) => {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      // Too slow / too small → not a swipe
      if (Math.max(adx, ady) < threshold) return;
      // Must be dominantly along one axis (1.6× the other)
      if (adx > ady * 1.4) {
        if (dx < 0) handlers.onSwipeLeft?.();
        else handlers.onSwipeRight?.();
      } else if (ady > adx * 1.4) {
        if (dy < 0) handlers.onSwipeUp?.();
        else handlers.onSwipeDown?.();
      }
    },
  };
};
