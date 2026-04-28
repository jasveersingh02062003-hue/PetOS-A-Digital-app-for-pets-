import { motion } from "framer-motion";

type Option = { value: string; label: string; blurb?: string };

export const ChipGroup = ({
  options, value, onChange, multi = true, columns = 2,
}: {
  options: (Option | string)[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
  columns?: 1 | 2 | 3;
}) => {
  const opts: Option[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const toggle = (v: string) => {
    if (!multi) return onChange([v]);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const grid =
    columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${grid} gap-2.5`}>
      {opts.map((o, i) => {
        const active = value.includes(o.value);
        return (
          <motion.button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025, duration: 0.25 }}
            whileTap={{ scale: 0.97 }}
            className={`text-left rounded-2xl border p-4 transition-all ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-hairline hover:border-primary/40"
            }`}
          >
            <div className="font-medium text-sm leading-tight">{o.label}</div>
            {o.blurb && (
              <div className={`text-[11px] mt-1 leading-snug ${
                active ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}>
                {o.blurb}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
