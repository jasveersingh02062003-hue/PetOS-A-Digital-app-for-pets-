import { useState, useEffect } from "react";

export type LayoutMode = "mobile-app" | "web";

/**
 * useLayoutMode — detects if the app is running in 'standalone' (installed) mode
 * or as a standard website. Also considers screen width for desktop-first layouts.
 */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("web");

  useEffect(() => {
    const checkMode = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
                        || (window.navigator as any).standalone 
                        || document.referrer.includes("android-app://");
      
      const isLargeScreen = window.innerWidth >= 1024;

      // If it's a large screen, always use web layout
      if (isLargeScreen) {
        setMode("web");
      } else if (isStandalone) {
        setMode("mobile-app");
      } else {
        // Standard mobile browser gets web layout (responsive) but behaves like a site
        setMode("web");
      }
    };

    checkMode();
    window.addEventListener("resize", checkMode);
    return () => window.removeEventListener("resize", checkMode);
  }, []);

  return mode;
}
