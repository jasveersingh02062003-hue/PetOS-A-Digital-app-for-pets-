import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type HealthKind = "meal" | "walk" | "weight" | "mood" | "grooming" | "medication" | "symptom";

const KINDS: { kind: HealthKind; emoji: string; label: string; valueLabel?: string; unit?: string; type?: "number" | "text" }[] = [
  { kind: "meal", emoji: "🍖", label: "Meal" },
  { kind: "walk", emoji: "🚶", label: "Walk", valueLabel: "Minutes", unit: "min", type: "number" },
  { kind: "weight", emoji: "⚖️", label: "Weight", valueLabel: "Weight", unit: "kg", type: "number" },
  { kind: "mood", emoji: "🐶", label: "Mood" },
  { kind: "grooming", emoji: "✂️", label: "Grooming" },
  { kind: "medication", emoji: "💊", label: "Med" },
  { kind: "symptom", emoji: "🤒", label: "Symptom" },
];

export type HealthTag = { kind: HealthKind; pet_id: string; value: any | null };

export const HealthTagPicker = ({
  pets,
  value,
  onChange,
}: {
  pets: { id: string; name: string }[];
  value: HealthTag | null;
  onChange: (v: HealthTag | null) => void;
}) => {
  const [open, setOpen] = useState(!!value);

  if (!pets.length) return null;

  const current = value ? KINDS.find((k) => k.kind === value.kind) : null;

  return (
    <div className="rounded-xl border border-hairline bg-muted/30">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (!next) onChange(null);
          else if (!value) onChange({ kind: "meal", pet_id: pets[0].id, value: null });
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm"
      >
        <Activity className="h-4 w-4 text-primary" />
        <span className="font-medium">Tag as health log</span>
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && value && (
        <div className="p-3 pt-0 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => onChange({ ...value, kind: k.kind, value: null })}
                className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 border transition-colors ${
                  value.kind === k.kind ? "bg-primary text-primary-foreground border-primary" : "border-hairline bg-background"
                }`}
              >
                <span>{k.emoji}</span> {k.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Select value={value.pet_id} onValueChange={(v) => onChange({ ...value, pet_id: v })}>
              <SelectTrigger className="h-9 rounded-lg border-hairline text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {current?.valueLabel && (
              <div className="relative flex-1">
                <Input
                  type={current.type ?? "text"}
                  step="0.1"
                  inputMode="decimal"
                  placeholder={current.valueLabel}
                  className="h-9 rounded-lg border-hairline text-xs pr-10"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return onChange({ ...value, value: null });
                    const n = Number(v);
                    onChange({ ...value, value: { [current.unit ?? "v"]: isNaN(n) ? v : n } });
                  }}
                />
                {current.unit && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {current.unit}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
