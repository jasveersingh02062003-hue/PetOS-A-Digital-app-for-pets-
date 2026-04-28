import { logError } from "./logError";

/**
 * Installs window-level error + unhandledrejection listeners that forward
 * to the central client logger. Idempotent — safe to call once on boot.
 * Filters noisy "ResizeObserver" / extension-injected errors that aren't
 * actionable for the app.
 */
let installed = false;
const NOISE = [
  "ResizeObserver loop",
  "Non-Error promise rejection captured",
  "Script error.",
];

function isNoise(msg: string) {
  return NOISE.some((n) => msg.includes(n));
}

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    const msg = e?.message ?? String(e?.error ?? "window error");
    if (isNoise(msg)) return;
    logError(e.error ?? msg, {
      source: "window:error",
      meta: {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    const msg =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "unhandled rejection";
    if (isNoise(msg)) return;
    logError(reason ?? msg, { source: "window:unhandledrejection" });
  });
}