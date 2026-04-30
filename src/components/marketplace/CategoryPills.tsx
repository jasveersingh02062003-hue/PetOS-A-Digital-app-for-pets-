type Item = { key: string; label: string; icon?: React.ReactNode };

type Props<K extends string> = {
  items: { key: K; label: string; icon?: React.ReactNode }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

/** Horizontal scrolling category pill row — Flipkart-style. */
export function CategoryPills<K extends string>({ items, value, onChange, className = "" }: Props<K>) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar ${className}`}>
      {items.map(({ key, label, icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-hairline hover:bg-muted text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}