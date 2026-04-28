import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { toast } from "sonner";

/**
 * Subtle top-of-viewport banner that appears when the device is offline.
 * On reconnect, refetches stale React Query data and shows a brief toast.
 */
export const OfflineBanner = () => {
  const online = useOnline();
  const qc = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online");
      // Refresh any queries that turned stale while offline.
      qc.invalidateQueries();
    }
  }, [online, qc]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-xs font-medium py-1.5 pad-top-safe shadow-md"
    >
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — changes will retry when reconnected
    </div>
  );
};