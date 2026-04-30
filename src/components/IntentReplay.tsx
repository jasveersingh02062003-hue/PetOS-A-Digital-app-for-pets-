import { useIntentReplay } from "@/hooks/useIntentReplay";

/** Mount-only component — runs the global intent-replay effect. */
export const IntentReplay = () => {
  useIntentReplay();
  return null;
};