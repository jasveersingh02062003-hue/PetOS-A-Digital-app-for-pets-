import { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /** Optional explicit aspect ratio (e.g. "1/1", "16/9") to reserve layout space */
  aspect?: string;
  /** When true, uses fetchpriority="high" and loading="eager" — for above-the-fold hero images only */
  priority?: boolean;
};

/**
 * LazyImage — drop-in <img loading="lazy" decoding="async"> with sensible defaults for performance:
 *  - lazy loading + async decode by default
 *  - reserves aspect-ratio so layout doesn't jump
 *  - graceful fallback on error (transparent placeholder)
 */
export function LazyImage({
  aspect,
  priority,
  loading,
  decoding,
  fetchPriority,
  style,
  onError,
  alt = "",
  ...rest
}: Props) {
  return (
    <img
      {...rest}
      alt={alt}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      // @ts-expect-error fetchpriority is valid HTML, not yet typed in all DOM lib versions
      fetchpriority={fetchPriority ?? (priority ? "high" : "low")}
      style={{ aspectRatio: aspect, ...style }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        onError?.(e);
      }}
    />
  );
}
