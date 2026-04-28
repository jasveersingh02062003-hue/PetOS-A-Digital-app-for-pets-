import { useEffect } from "react";
import { applySeo } from "@/lib/seo";

type Opts = Parameters<typeof applySeo>[0];

/**
 * useSeo — apply SEO meta tags + JSON-LD for the current page.
 * Re-applies whenever any option changes.
 */
export function useSeo(opts: Opts) {
  useEffect(() => {
    applySeo(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(opts)]);
}
