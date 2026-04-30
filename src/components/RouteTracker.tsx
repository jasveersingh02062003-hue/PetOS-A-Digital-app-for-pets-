import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/**
 * Fires a `page_view` analytics event on every route change.
 * Mounted once inside <BrowserRouter>.
 */
export const RouteTracker = () => {
  const loc = useLocation();
  useEffect(() => {
    trackPageView();
  }, [loc.pathname]);
  return null;
};