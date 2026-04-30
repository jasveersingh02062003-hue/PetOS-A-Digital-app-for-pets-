import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getStoredConsent, setAnalyticsConsent } from "@/lib/analytics";

/**
 * Phase 10 — minimal first-party analytics consent banner.
 * - Shown only when there is no stored choice yet.
 * - Auto-suppressed when navigator.doNotTrack is set.
 * - We use no third-party trackers, so this only governs first-party
 *   product analytics (page views + custom events).
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;
    if (getStoredConsent() === null) {
      // Defer one tick so we never block first paint.
      const t = window.setTimeout(() => setShow(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-[80] rounded-2xl border border-hairline bg-card/95 backdrop-blur p-4 shadow-lg sm:max-w-md sm:left-auto sm:right-3"
    >
      <p className="text-sm text-foreground/90 leading-snug">
        We use a small amount of first-party analytics to understand how Petos
        is used. No third-party trackers, no ad networks.{" "}
        <Link to="/legal/privacy" className="underline">
          Learn more
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => choose(false)}>
          Decline
        </Button>
        <Button size="sm" onClick={() => choose(true)}>
          Allow
        </Button>
      </div>
    </div>
  );
}