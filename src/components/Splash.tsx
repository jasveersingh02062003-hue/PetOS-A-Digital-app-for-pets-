import { forwardRef } from "react";

interface SplashProps {
  children: React.ReactNode;
}

/**
 * Keep this wrapper non-blocking. A previous animated splash could cover the app
 * with a blank background if animation/session timing failed in preview/mobile.
 */
export const Splash = forwardRef<HTMLDivElement, SplashProps>(({ children }, ref) => {
  return <div ref={ref}>{children}</div>;
});

Splash.displayName = "Splash";
