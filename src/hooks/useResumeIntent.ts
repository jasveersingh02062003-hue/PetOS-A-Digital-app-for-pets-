import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Pages call this with the intent kind they care about. When the user comes
 * back from OTP verification, the URL has `?resume=<kind>` — we fire `cb`
 * once and strip the query so refreshes don't replay it.
 */
export function useResumeIntent(kind: string, cb: () => void) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(loc.search);
    if (params.get("resume") !== kind) return;
    cb();
    params.delete("resume");
    nav({ pathname: loc.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, loc.search]);
}