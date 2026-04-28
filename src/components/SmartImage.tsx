import { ImgHTMLAttributes, useState } from "react";

type Variants = {
  thumb?: string | null;
  feed?: string | null;
  full?: string | null;
};

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Pick the right variant for this slot. */
  variant?: "thumb" | "feed" | "full";
  /** Either pass an object with all variants, or a single fallback URL. */
  src?: string | null;
  variants?: Variants | null;
  /** Aspect ratio reservation (e.g. "1/1", "4/5") to prevent CLS. */
  aspect?: string;
  /** Above-the-fold? Loads eager + high priority. */
  priority?: boolean;
};

/**
 * SmartImage — picks the best WebP/JPEG variant for the slot, falls back to
 * the original `image_url` for old posts, and reserves layout space so the UI
 * never jumps as images load.
 */
export function SmartImage({
  variant = "feed",
  src,
  variants,
  aspect,
  priority,
  className,
  style,
  alt = "",
  onLoad,
  onError,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const chosen =
    variants?.[variant] ??
    variants?.feed ??
    variants?.full ??
    variants?.thumb ??
    src ??
    null;

  if (!chosen || failed) {
    return (
      <div
        className={`bg-muted ${className ?? ""}`}
        style={{ aspectRatio: aspect, ...style }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-muted ${className ?? ""}`}
      style={{ aspectRatio: aspect, ...style }}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />
      )}
      <img
        {...rest}
        src={chosen}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // @ts-expect-error fetchpriority is a valid HTML attr not yet typed
        fetchpriority={priority ? "high" : "low"}
        onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
        onError={(e) => { setFailed(true); onError?.(e); }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        draggable={false}
      />
    </div>
  );
}
