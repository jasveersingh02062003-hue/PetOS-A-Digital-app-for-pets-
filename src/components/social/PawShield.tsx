import { SVGProps } from "react";

/**
 * Custom paw-shield mark — used for the verified-vaccinations chip.
 * Replaces a generic ShieldCheck so the trust signal feels Petos-native.
 */
export const PawShield = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" fill="currentColor" fillOpacity="0.12" />
    <circle cx="9" cy="11" r="1.2" fill="currentColor" />
    <circle cx="15" cy="11" r="1.2" fill="currentColor" />
    <circle cx="8" cy="14" r="0.9" fill="currentColor" />
    <circle cx="16" cy="14" r="0.9" fill="currentColor" />
    <path d="M10 16.5c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="currentColor" />
  </svg>
);

export default PawShield;
