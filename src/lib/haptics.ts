// Subtle haptic feedback for important touch actions
export const haptic = (ms: number = 10) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // ignore
  }
};
