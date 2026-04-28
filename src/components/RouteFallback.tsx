import { PetosLogo } from "./PetosLogo";

/**
 * Lightweight full-screen loader shown while lazy route chunks are loading.
 * Matches the splash aesthetic so route swaps feel calm.
 */
export function RouteFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <PetosLogo className="h-8 opacity-70" showPaw />
        <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 bg-primary/60 animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
