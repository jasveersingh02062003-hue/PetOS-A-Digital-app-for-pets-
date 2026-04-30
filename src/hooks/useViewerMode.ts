import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current visitor is an authenticated 'member' or a public
 * 'guest', and whether the app is currently running in installed-PWA mode.
 * Used to adapt CTAs, hide composers, and surface install nudges.
 */
export function useViewerMode() {
  const { user, loading } = useAuth();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setStandalone(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return {
    mode: user ? ("member" as const) : ("guest" as const),
    isGuest: !user,
    isMember: !!user,
    isStandalone: standalone,
    loading,
  };
}