import { logEdgeError } from "./logError.ts";

/**
 * Wraps an edge-function handler with structured timing + error capture.
 * Logs `{ fn, status, duration_ms }` to console (visible in Edge Function logs)
 * on every request, and forwards thrown errors to public.error_log.
 *
 * Usage:
 *   Deno.serve(observe("my-fn", async (req) => { ... return new Response(...) }))
 */
export function observe(
  fnName: string,
  handler: (req: Request) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    const started = performance.now();
    let status = 0;
    try {
      const res = await handler(req);
      status = res.status;
      return res;
    } catch (err) {
      status = 500;
      const message = err instanceof Error ? err.message : String(err);
      // best-effort persistent log
      void logEdgeError(fnName, err, {
        meta: { method: req.method, url: new URL(req.url).pathname },
      });
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      const ms = Math.round(performance.now() - started);
      // Single-line structured log; cheap to grep.
      console.log(JSON.stringify({
        fn: fnName,
        method: req.method,
        status,
        duration_ms: ms,
      }));
    }
  };
}