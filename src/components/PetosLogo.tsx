import { cn } from "@/lib/utils";

interface PetosLogoProps {
  className?: string;
  showPaw?: boolean;
}

/**
 * Petos wordmark + paw mark. Pure SVG so it scales infinitely and stays sharp.
 * Each letter has a stable id so the splash component can stagger animations.
 */
export const PetosLogo = ({ className, showPaw = true }: PetosLogoProps) => (
  <svg
    viewBox="0 0 280 90"
    className={cn("w-auto h-20", className)}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Petos"
  >
    {showPaw && (
      <g id="petos-paw" className="origin-center">
        <circle cx="32" cy="48" r="20" fill="hsl(var(--primary))" opacity="0.12" />
        <circle cx="22" cy="40" r="4.5" fill="hsl(var(--primary))" />
        <circle cx="32" cy="36" r="5" fill="hsl(var(--primary))" />
        <circle cx="42" cy="40" r="4.5" fill="hsl(var(--primary))" />
        <ellipse cx="32" cy="52" rx="9" ry="7" fill="hsl(var(--primary))" />
      </g>
    )}
    {["P", "e", "t", "o", "s"].map((ch, i) => (
      <text
        key={i}
        id={`petos-letter-${i}`}
        x={75 + i * 38}
        y="62"
        fontFamily="ui-serif, Georgia, serif"
        fontSize="56"
        fontWeight="500"
        fill="hsl(var(--foreground))"
        letterSpacing="-0.02em"
      >
        {ch}
      </text>
    ))}
  </svg>
);
