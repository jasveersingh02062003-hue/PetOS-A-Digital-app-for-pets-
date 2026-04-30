import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X, MapPin, ShieldCheck, Clock, Heart } from "lucide-react";
import { POPULAR_CITIES } from "@/hooks/useGeoCity";
import { BREEDS } from "@/lib/breeds";

export type ListingFilterValue = {
  species?: string;
  breed?: string;
  city?: string;
  gender?: string;
  priceMin?: number;
  priceMax?: number;
  ageMonths?: string;        // "0-3" | "3-6" | "6-12" | "12+"
  verifiedOnly?: boolean;
  openNow?: boolean;
  matingOnly?: boolean;
  sort?: "nearest" | "newest" | "price_asc" | "price_desc" | "soonest_available" | "rating";
};

type Props = {
  value: ListingFilterValue;
  onChange: (next: ListingFilterValue) => void;
  showSpecies?: boolean;
  showBreed?: boolean;
  showAge?: boolean;
  showGender?: boolean;
  showPrice?: boolean;
  showVerified?: boolean;
  showSort?: boolean;
  /** show "Open now" pill (service hubs) */
  showOpenNow?: boolean;
  /** show "Mating only" pill (adopt hub) */
  showMatingOnly?: boolean;
  /** include "Soonest available" sort option */
  showSoonestAvailable?: boolean;
};

const SPECIES = ["dog", "cat", "bird", "rabbit", "other"];
const AGE_BUCKETS = [
  { v: "0-3", label: "0–3 mo" },
  { v: "3-6", label: "3–6 mo" },
  { v: "6-12", label: "6–12 mo" },
  { v: "12+", label: "1 yr +" },
];

export const ListingFilters = ({
  value,
  onChange,
  showSpecies = true,
  showBreed = true,
  showAge = true,
  showGender = true,
  showPrice = true,
  showVerified = true,
  showSort = true,
  showOpenNow = false,
  showMatingOnly = false,
  showSoonestAvailable = false,
}: Props) => {
  const set = <K extends keyof ListingFilterValue>(k: K, v: ListingFilterValue[K]) =>
    onChange({ ...value, [k]: v });

  const breeds = value.species && BREEDS[value.species] ? BREEDS[value.species] : [];
  const activeCount = Object.values(value).filter((v) => v !== undefined && v !== "" && v !== false).length;

  const reset = () => onChange({ sort: value.sort });

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Filters</span>
        {activeCount > 0 && <Badge variant="secondary" className="text-[10px]">{activeCount} active</Badge>}
        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {showSpecies && (
          <Select value={value.species ?? "any"} onValueChange={(v) => set("species", v === "any" ? undefined : v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Species" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any species</SelectItem>
              {SPECIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showBreed && (
          <Select value={value.breed ?? "any"} onValueChange={(v) => set("breed", v === "any" ? undefined : v)} disabled={!breeds.length}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Breed" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any breed</SelectItem>
              {breeds.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={value.city ?? "any"} onValueChange={(v) => set("city", v === "any" ? undefined : v)}>
          <SelectTrigger className="h-10 rounded-xl">
            <MapPin className="h-3.5 w-3.5 mr-1 opacity-60" /><SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any city</SelectItem>
            {POPULAR_CITIES.map((c) => <SelectItem key={c.slug} value={c.label}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {showGender && (
          <Select value={value.gender ?? "any"} onValueChange={(v) => set("gender", v === "any" ? undefined : v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any gender</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        )}

        {showAge && (
          <Select value={value.ageMonths ?? "any"} onValueChange={(v) => set("ageMonths", v === "any" ? undefined : v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Age" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any age</SelectItem>
              {AGE_BUCKETS.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showSort && (
          <Select value={value.sort ?? "newest"} onValueChange={(v) => set("sort", v as any)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest first</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="rating">Top rated</SelectItem>
              {showSoonestAvailable && <SelectItem value="soonest_available">Soonest available</SelectItem>}
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {(showOpenNow || showMatingOnly || showVerified) && (
        <div className="flex flex-wrap gap-2">
          {showOpenNow && (
            <Button
              variant={value.openNow ? "default" : "outline"}
              size="sm"
              onClick={() => set("openNow", !value.openNow ? true : undefined)}
              className="h-8 rounded-full text-xs gap-1.5"
            >
              <Clock className="h-3 w-3" /> Open now
            </Button>
          )}
          {showMatingOnly && (
            <Button
              variant={value.matingOnly ? "default" : "outline"}
              size="sm"
              onClick={() => set("matingOnly", !value.matingOnly ? true : undefined)}
              className="h-8 rounded-full text-xs gap-1.5"
            >
              <Heart className="h-3 w-3" /> Mating only
            </Button>
          )}
          {showVerified && (
            <Button
              variant={value.verifiedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => set("verifiedOnly", !value.verifiedOnly ? true : undefined)}
              className="h-8 rounded-full text-xs gap-1.5"
            >
              <ShieldCheck className="h-3 w-3" /> Verified only
            </Button>
          )}
        </div>
      )}

      {showPrice && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number" inputMode="numeric" placeholder="Min ₹"
            className="h-10 rounded-xl"
            value={value.priceMin ?? ""}
            onChange={(e) => set("priceMin", e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number" inputMode="numeric" placeholder="Max ₹"
            className="h-10 rounded-xl"
            value={value.priceMax ?? ""}
            onChange={(e) => set("priceMax", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      )}
    </div>
  );
};