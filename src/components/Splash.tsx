import { forwardRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PetosLogo } from "./PetosLogo";

const SPLASH_KEY = "petos_splash_shown";

interface SplashProps {
  children: React.ReactNode;
}

/**
 * Cold-start splash. Shows once per browser session (sessionStorage).
 * Auto-dismisses after ~1.6s, or on tap.
 *
 * Wrapped in forwardRef so framer-motion's <AnimatePresence> can attach
 * its internal ref without triggering React's "Function components cannot
 * be given refs" warning.
 */
export const Splash = forwardRef<HTMLDivElement, SplashProps>(({ children }, ref) => {
  const reduceMotion = useReducedMotion();
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SPLASH_KEY) !== "1";
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => dismiss(), reduceMotion ? 700 : 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduceMotion]);

  const dismiss = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShow(false);
  };

  return (
    <div ref={ref}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            key="splash"
            onClick={dismiss}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background cursor-pointer"
            aria-hidden="true"
          >
            {reduceMotion ? (
              <PetosLogo className="h-24" />
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.4, ease: "easeInOut", times: [0, 0.5, 1] }}
                >
                  <PetosLogo className="h-24" />
                </motion.div>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0.1 : 0.7, duration: 0.5 }}
              className="mt-3 text-sm text-muted-foreground"
            >
              A complete digital life for every pet
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

Splash.displayName = "Splash";
