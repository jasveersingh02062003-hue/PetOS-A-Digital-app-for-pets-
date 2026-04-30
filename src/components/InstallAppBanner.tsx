import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { useViewerMode } from "@/hooks/useViewerMode";

const KEY = "petos:install-banner-dismissed";

/**
 * Slim "Install app for the full experience" banner.
 * Shown only when the visitor is browsing the public website (NOT the
 * installed PWA). Auto-hides if dismissed or already standalone.
 */
export const InstallAppBanner = () => {
  const { isStandalone } = useViewerMode();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(KEY) === "1");
  }, []);

  if (isStandalone || dismissed) return null;

  return (
    <div className="bg-primary text-primary-foreground text-xs">
      <div className="container-app h-9 flex items-center gap-2">
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">
          Install Petos for push alerts, faster browsing, and offline access.
        </span>
        <button
          type="button"
          aria-label="Dismiss install banner"
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setDismissed(true);
          }}
          className="opacity-80 hover:opacity-100 p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};