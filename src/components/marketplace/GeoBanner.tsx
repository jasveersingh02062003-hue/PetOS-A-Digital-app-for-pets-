import { useState } from "react";
import { MapPin, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useGeoCity, POPULAR_CITIES } from "@/hooks/useGeoCity";

type Props = {
  /** Called whenever the city changes. Slug form ("new-delhi"). */
  onCityChange?: (slug: string | null) => void;
};

/**
 * 1-tap city banner shown atop discovery hubs. Reads the user's resolved
 * geo city, lets them swap in a single sheet, and persists the choice.
 */
export const GeoBanner = ({ onCityChange }: Props) => {
  const { city, displayCity, setCity, loading } = useGeoCity();
  const [open, setOpen] = useState(false);

  const pick = (slug: string | null, label?: string) => {
    if (slug) {
      setCity(label ?? slug);
      onCityChange?.(slug);
    } else {
      setCity(null);
      onCityChange?.(null);
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-hairline bg-card px-3 py-2 text-left mb-3 active:scale-[0.99] transition"
      >
        <span className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Showing</span>
          <span className="font-medium">{loading ? "…" : (displayCity ?? "All cities")}</span>
        </span>
        <span className="text-xs text-primary font-medium">Change</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Choose your city</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              variant={city === null ? "default" : "outline"}
              className="justify-between rounded-xl h-11"
              onClick={() => pick(null)}
            >
              All cities
              {city === null && <Check className="h-4 w-4" />}
            </Button>
            {POPULAR_CITIES.map((c) => (
              <Button
                key={c.slug}
                variant={city === c.slug ? "default" : "outline"}
                className="justify-between rounded-xl h-11"
                onClick={() => pick(c.slug, c.label)}
              >
                {c.label}
                {city === c.slug && <Check className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};