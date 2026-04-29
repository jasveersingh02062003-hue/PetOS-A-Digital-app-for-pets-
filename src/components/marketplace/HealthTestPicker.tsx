import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { HEALTH_TESTS, type HealthTestEntry, findTest } from "@/lib/healthTests";
import { HealthTestChip } from "./HealthTestChip";

/**
 * Multi-select for health screening tests during listing creation.
 * Caller controls the array via `value`/`onChange`.
 */
export const HealthTestPicker = ({
  species,
  value,
  onChange,
}: {
  species?: string;
  value: HealthTestEntry[];
  onChange: (next: HealthTestEntry[]) => void;
}) => {
  const [pickedCode, setPickedCode] = useState<string>("");
  const [pickedResult, setPickedResult] = useState<string>("");

  const available = HEALTH_TESTS.filter((t) => {
    if (species && t.species && !t.species.includes(species as any)) return false;
    return !value.some((v) => v.code === t.code);
  });
  const def = pickedCode ? findTest(pickedCode) : null;

  const add = () => {
    if (!def || !pickedResult) return;
    onChange([...value, { code: def.code, label: def.label, result: pickedResult }]);
    setPickedCode("");
    setPickedResult("");
  };

  const remove = (code: string) => onChange(value.filter((v) => v.code !== code));

  return (
    <div className="space-y-2">
      {!!value.length && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((e) => (
            <span key={e.code} className="inline-flex items-center gap-1">
              <HealthTestChip entry={e} />
              <button
                type="button"
                onClick={() => remove(e.code)}
                className="text-muted-foreground hover:text-destructive p-0.5"
                aria-label={`Remove ${e.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Select
            value={pickedCode}
            onValueChange={(v) => {
              setPickedCode(v);
              setPickedResult("");
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Add test…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  All tests added
                </div>
              ) : (
                available.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={pickedResult} onValueChange={setPickedResult} disabled={!def}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent>
              {def?.results.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={add}
          disabled={!def || !pickedResult}
          className="h-9 w-9 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Self-reported until a vet attests via the health vault. Buyers will see results as chips on the listing.
      </p>
    </div>
  );
};