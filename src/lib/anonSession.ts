/**
 * Stable per-browser anonymous session id used to attribute pre-auth actions
 * (sightings, intent telemetry, anon reports) without an account.
 */
const KEY = "petos_anon_session_id";

export function getAnonSessionId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}