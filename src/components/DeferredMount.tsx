import { useEffect, useState, ReactNode } from "react";

/**
 * Mounts children only after the browser is idle (or after `timeoutMs` as fallback).
 * Used to keep heavy non-critical providers/widgets out of the first-paint critical path.
 */
export const DeferredMount = ({ children, timeoutMs = 1500 }: { children: ReactNode; timeoutMs?: number }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ric: any = (window as any).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(() => setReady(true), { timeout: timeoutMs });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);
  return ready ? <>{children}</> : null;
};

export default DeferredMount;
