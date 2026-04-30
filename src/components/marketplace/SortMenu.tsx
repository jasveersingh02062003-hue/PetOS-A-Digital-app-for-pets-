import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowDownUp, Check } from "lucide-react";

export type SortKey = "nearest" | "newest" | "rating" | "price_asc" | "price_desc";

const ALL: { key: SortKey; label: string }[] = [
  { key: "nearest", label: "Nearest first" },
  { key: "newest", label: "Newest" },
  { key: "rating", label: "Top rated" },
  { key: "price_asc", label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
];

type Props = {
  value: SortKey;
  onChange: (k: SortKey) => void;
  /** Limit which options to show (e.g. omit "rating" on Shop). */
  options?: SortKey[];
  className?: string;
};

export const SortMenu = ({ value, onChange, options, className = "" }: Props) => {
  const items = options ? ALL.filter((o) => options.includes(o.key)) : ALL;
  const current = items.find((i) => i.key === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`rounded-full h-9 gap-1.5 ${className}`}>
          <ArrowDownUp className="h-3.5 w-3.5" />
          <span className="text-xs">{current?.label ?? "Sort"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map((i) => (
          <DropdownMenuItem key={i.key} onClick={() => onChange(i.key)} className="justify-between">
            <span>{i.label}</span>
            {i.key === value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};