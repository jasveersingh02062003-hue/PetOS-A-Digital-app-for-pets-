import { useEffect, useRef } from "react";
import { onlineManager } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Phase 9 — non-intrusive online/offline UX.
 * - Shows a persistent toast while offline.
 * - Confirms when connectivity returns.
 * Keep this mounted near the top of the tree.
 */
export function NetworkStatus() {
  const offlineToastRef = useRef<string | number | null>(null);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const apply = (online: boolean) => {
      if (!online) {
        wasOfflineRef.current = true;
        if (offlineToastRef.current == null) {
          offlineToastRef.current = toast("You're offline", {
            description: "Some features may be unavailable until you reconnect.",
            duration: Infinity,
          });
        }
        return;
      }
      // online
      if (offlineToastRef.current != null) {
        toast.dismiss(offlineToastRef.current);
        offlineToastRef.current = null;
      }
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        toast.success("Back online");
      }
    };
    apply(onlineManager.isOnline());
    const unsub = onlineManager.subscribe(apply);
    return () => {
      unsub();
      if (offlineToastRef.current != null) {
        toast.dismiss(offlineToastRef.current);
        offlineToastRef.current = null;
      }
    };
  }, []);

  return null;
}