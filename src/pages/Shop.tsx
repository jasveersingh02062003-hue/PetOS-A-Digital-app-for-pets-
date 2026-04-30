import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, ShoppingCart, Package, ShieldCheck,
  Search, X, SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { usePets } from "@/hooks/useProfile";
import { SubjectRating } from "@/components/SubjectRating";
import { ReorderReminderButton } from "@/components/shop/ReorderReminderButton";
import type { Database } from "@/integrations/supabase/types";
import { useNearbyQuery } from "@/hooks/useNearbyQuery";
import { DistanceChip } from "@/components/marketplace/DistanceChip";
import { PincodeEta } from "@/components/shop/PincodeEta";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { ResultsHeader } from "@/components/marketplace/ResultsHeader";

type ProductCategory = Database["public"]["Enums"]["product_category"];

const cats: { key: ProductCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "toys", label: "Toys" },
  { key: "accessories", label: "Accessories" },
  { key: "health", label: "Health" },
  { key: "grooming", label: "Grooming" },
];

type SortKey = "nearest" | "newest" | "price_asc" | "price_desc" | "title_asc";
const sortOptions: { key: SortKey; label: string }[] = [
  { key: "nearest", label: "Nearest first" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
  { key: "title_asc", label: "Name A→Z" },
];

const useDebounced = <T,>(v: T, ms = 250): T => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

const Shop = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [cat, setCat] = useState<ProductCategory | "all">(
    (params.get("cat") as ProductCategory | "all" | null) ?? "all",
  );
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SortKey>(
    (params.get("sort") as SortKey | null) ?? "newest",
  );
  const [minPrice, setMinPrice] = useState<string>(params.get("min") ?? "");
  const [maxPrice, setMaxPrice] = useState<string>(params.get("max") ?? "");
  const [inStock, setInStock] = useState<boolean>(params.get("stock") !== "0");
  const [activeTags, setActiveTags] = useState<string[]>(
    (params.get("tags") || "").split(",").filter(Boolean),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideAllergens, setHideAllergens] = useState(true);

  const debouncedQuery = useDebounced(query.trim(), 300);

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (cat !== "all") next.set("cat", cat);
    if (debouncedQuery) next.set("q", debouncedQuery);
    if (sort !== "newest") next.set("sort", sort);
    if (minPrice) next.set("min", minPrice);
    if (maxPrice) next.set("max", maxPrice);
    if (!inStock) next.set("stock", "0");
    if (activeTags.length) next.set("tags", activeTags.join(","));
    setParams(next, { replace: true });
  }, [cat, debouncedQuery, sort, minPrice, maxPrice, inStock, activeTags, setParams]);

  const { add, count } = useCart();
  const { data: myPets } = usePets();

  const allergyTerms = useMemo(() => {
    const set = new Set<string>();
    (myPets ?? []).forEach((p: any) => (p.allergies ?? []).forEach((a: string) => {
      const t = (a ?? "").trim().toLowerCase();
      if (t.length >= 3) set.add(t);
    }));
    return [...set];
  }, [myPets]);

  const allergyPetName = useMemo(() => {
    const p = (myPets ?? []).find((x: any) => (x.allergies ?? []).length > 0);
    return p?.name as string | undefined;
  }, [myPets]);

  // Standard table query (used for sort != nearest)
  const { data: tableProducts, isLoading: tableLoading } = useQuery({
    queryKey: ["shop_products", cat, debouncedQuery, sort, minPrice, maxPrice, inStock],
    enabled: sort !== "nearest",
    queryFn: async () => {
      let q = supabase
        .from("shop_products")
        .select("*")
        .eq("active", true)
        .limit(120);

      if (cat !== "all") q = q.eq("category", cat);
      if (inStock) q = q.gt("stock", 0);

      const minN = Number(minPrice);
      if (Number.isFinite(minN) && minN > 0) q = q.gte("price_inr", minN);
      const maxN = Number(maxPrice);
      if (Number.isFinite(maxN) && maxN > 0) q = q.lte("price_inr", maxN);

      if (debouncedQuery.length >= 2) {
        const like = `%${debouncedQuery.replace(/[%_]/g, "")}%`;
        q = q.or(`title.ilike.${like},description.ilike.${like}`);
      }

      switch (sort) {
        case "price_asc": q = q.order("price_inr", { ascending: true }); break;
        case "price_desc": q = q.order("price_inr", { ascending: false }); break;
        case "title_asc": q = q.order("title", { ascending: true }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Nearest-first via composite_score RPC
  const { data: nearbyProducts, isLoading: nearbyLoading } = useNearbyQuery<any>(
    "discover_shop_products",
    {
      _category: cat === "all" ? null : cat,
      _query: debouncedQuery.length >= 2 ? debouncedQuery : null,
      _radius_km: 200,
      _limit: 120,
    },
    { enabled: sort === "nearest" },
  );

  const products = useMemo(() => {
    if (sort !== "nearest") return tableProducts as any[] | undefined;
    let list = (nearbyProducts ?? []) as any[];
    if (inStock) list = list.filter((p) => (p.stock ?? 0) > 0);
    const minN = Number(minPrice);
    if (Number.isFinite(minN) && minN > 0) list = list.filter((p) => (p.price_inr ?? 0) >= minN);
    const maxN = Number(maxPrice);
    if (Number.isFinite(maxN) && maxN > 0) list = list.filter((p) => (p.price_inr ?? 0) <= maxN);
    return list;
  }, [sort, tableProducts, nearbyProducts, inStock, minPrice, maxPrice]);
  const isLoading = sort === "nearest" ? nearbyLoading : tableLoading;

  const isUnsafe = (p: any) => {
    if (!hideAllergens || allergyTerms.length === 0) return false;
    const hay = `${p.title ?? ""} ${p.description ?? ""}`.toLowerCase();
    return allergyTerms.some((term) => hay.includes(term));
  };

  // Top tags from current result set (for chip filtering)
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    (products ?? []).forEach((p: any) => {
      (p.tags ?? []).forEach((t: string) => {
        const k = (t ?? "").trim().toLowerCase();
        if (k.length >= 2 && k.length <= 24) counts.set(k, (counts.get(k) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }, [products]);

  const matchesTags = (p: any) => {
    if (activeTags.length === 0) return true;
    const ptags = (p.tags ?? []).map((t: string) => (t ?? "").toLowerCase());
    return activeTags.every((t) => ptags.includes(t));
  };

  const visible = (products ?? []).filter((p) => !isUnsafe(p) && matchesTags(p));
  const hiddenCount = (products?.length ?? 0) - visible.length;

  const hasActiveFilters =
    cat !== "all" || !!debouncedQuery || sort !== "newest" ||
    !!minPrice || !!maxPrice || !inStock || activeTags.length > 0;

  const resetFilters = () => {
    setCat("all"); setQuery(""); setSort("newest");
    setMinPrice(""); setMaxPrice(""); setInStock(true); setActiveTags([]);
  };

  const toggleTag = (t: string) => {
    setActiveTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Shop</h1>
        <Button asChild variant="outline" size="icon" className="rounded-full relative">
          <Link to="/cart">
            <ShoppingCart className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-medium">
                {count}
              </span>
            )}
          </Link>
        </Button>
        <Button asChild size="icon" className="rounded-full">
          <Link to="/shop/new">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      {/* Search + filter toggle row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-9 pr-9 rounded-full h-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          variant={filtersOpen ? "default" : "outline"}
          size="icon"
          onClick={() => setFiltersOpen((v) => !v)}
          className="rounded-full shrink-0 relative"
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
          )}
        </Button>
      </div>

      {/* Delivery ETA — Zomato/Swiggy style "Deliver to" chip */}
      <div className="mb-3">
        <PincodeEta />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
        {cats.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCat(key)}
            className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
              cat === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-hairline hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expandable filter panel */}
      {filtersOpen && (
        <Card className="rounded-2xl border-hairline p-4 mb-3 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Sort by</div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Price (₹)</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="rounded-xl"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <label className="flex items-center justify-between text-sm">
            <span className="font-medium">In stock only</span>
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          {hasActiveFilters && (
            <Button variant="outline" onClick={resetFilters} className="w-full rounded-full">
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset filters
            </Button>
          )}
        </Card>
      )}

      {/* Tag chips from current result set */}
      {topTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
          {topTags.map((t) => {
            const on = activeTags.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
                  on
                    ? "bg-primary-soft text-primary border-primary/30"
                    : "bg-card border-hairline text-muted-foreground hover:bg-muted"
                }`}
              >
                #{t}
              </button>
            );
          })}
        </div>
      )}

      {allergyTerms.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-card px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              {hideAllergens
                ? hiddenCount > 0
                  ? `${hiddenCount} hidden — unsafe for ${allergyPetName ?? "your pet"}`
                  : `Filtering for ${allergyPetName ?? "your pet"}'s allergies`
                : "Allergy filter off"}
            </span>
          </div>
          <button
            onClick={() => setHideAllergens((v) => !v)}
            className="text-xs font-medium text-primary"
          >
            {hideAllergens ? "Show all" : "Hide unsafe"}
          </button>
        </div>
      )}

      {/* Result count — Amazon-style header */}
      {!isLoading && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <ResultsHeader count={visible.length} />
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-xs text-primary font-medium">Clear all</button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-hairline overflow-hidden p-0">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          {(products?.length ?? 0) === 0
            ? "No products match these filters."
            : "Nothing matches — try clearing filters or turning off the allergy filter."}
          {hasActiveFilters && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={resetFilters} className="rounded-full">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset filters
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((p) => (
          <ListingCard
            key={p.id}
            to={`/shop/${p.id}`}
            image={p.image_url}
            imageAlt={p.title}
            title={p.title}
            eyebrow={p.category}
            price={p.price_inr}
            distanceKm={p.distance_km != null ? Number(p.distance_km) : null}
            wishlistId={p.id}
            healthChips={p.stock > 0 ? [] : []}
            imageTag={p.stock <= 0 ? { label: "Out of stock", tone: "danger" } : undefined}
            cta={{
              label: p.stock <= 0 ? "Out of stock" : "Add to cart",
              requiresAuth: true,
              onClick: () =>
                add({
                  product_id: p.id,
                  seller_id: p.seller_id,
                  title: p.title,
                  price_inr: p.price_inr,
                  image_url: p.image_url,
                }),
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Shop;
