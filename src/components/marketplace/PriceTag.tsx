type Props = {
  /** Numeric value in the smallest currency unit's natural integer (₹35000 = 35000). */
  value?: number | null;
  currency?: "INR" | "USD";
  /** "/visit", "/hour", "/night", "+ taxes"… */
  suffix?: string;
  /** Strikethrough MRP, optional. */
  mrp?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** When true, renders "Contact for price" if value is null. */
  contactWhenNull?: boolean;
};

const fmt = (v: number, currency: "INR" | "USD") =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);

const SIZE = {
  sm: { value: "text-base font-semibold", suffix: "text-[10px]", mrp: "text-[10px]" },
  md: { value: "text-lg font-semibold",   suffix: "text-xs",     mrp: "text-xs" },
  lg: { value: "text-2xl font-display",   suffix: "text-xs",     mrp: "text-xs" },
};

/** Flipkart-style price: large numeral, small suffix, optional strike-through MRP. */
export const PriceTag = ({
  value,
  currency = "INR",
  suffix,
  mrp,
  size = "md",
  className = "",
  contactWhenNull,
}: Props) => {
  const s = SIZE[size];
  if (value == null || !isFinite(value)) {
    if (contactWhenNull) {
      return <span className={`${s.value} text-muted-foreground ${className}`}>Contact for price</span>;
    }
    return null;
  }
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={`${s.value} text-foreground tabular-nums leading-none`}>{fmt(value, currency)}</span>
      {suffix && <span className={`${s.suffix} text-muted-foreground leading-none`}>{suffix}</span>}
      {mrp != null && mrp > value && (
        <span className={`${s.mrp} text-muted-foreground line-through tabular-nums leading-none ml-1`}>
          {fmt(mrp, currency)}
        </span>
      )}
    </span>
  );
};