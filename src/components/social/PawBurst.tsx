import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Burst = { id: number; x: number; y: number };

/**
 * Imperative paw-burst overlay. Place `node` inside a `relative` parent
 * that matches the area you want bursts to render in. Call `burst(x, y)`
 * with coordinates relative to that parent.
 */
export const usePawBurst = () => {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const idRef = useRef(0);

  const burst = useCallback((x: number, y: number) => {
    const id = ++idRef.current;
    setBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => {
      setBursts((b) => b.filter((it) => it.id !== id));
    }, 800);
  }, []);

  const node = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {bursts.map((b) => (
          <PawSplash key={b.id} x={b.x} y={b.y} />
        ))}
      </AnimatePresence>
    </div>
  );

  return { burst, node };
};

const PawSplash = ({ x, y }: { x: number; y: number }) => {
  // 6 little paws fly outward
  const flecks = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 30;
    return {
      i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      rot: (Math.random() - 0.5) * 90,
      delay: Math.random() * 0.08,
    };
  });

  return (
    <>
      {/* Big centered paw */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.3, 1.1], opacity: [0, 1, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute select-none"
        style={{
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          fontSize: "96px",
          filter: "drop-shadow(0 4px 14px hsl(var(--primary) / 0.45))",
        }}
      >
        🐾
      </motion.div>
      {/* Radial flecks */}
      {flecks.map((f) => (
        <motion.div
          key={f.i}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ x: f.dx, y: f.dy, opacity: [0, 1, 0], scale: 1, rotate: f.rot }}
          transition={{ duration: 0.6, delay: f.delay, ease: "easeOut" }}
          className="absolute select-none"
          style={{
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            fontSize: "22px",
          }}
        >
          🐾
        </motion.div>
      ))}
    </>
  );
};
