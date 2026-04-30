import { useEffect, useState } from "react";

const KEY = "petos.user_city";

/**
 * Resolve the visitor's city for geo-targeted listing pages.
 * Strategy:
 *   1. Persisted choice (`localStorage["petos.user_city"]`) — user wins.
 *   2. Browser geolocation → reverse-geocode via free Nominatim endpoint.
 *   3. IP geolocation via ipapi.co fallback (no key required).
 * Returns the city slug (lowercase, hyphenated) and a setter the user can call
 * to override (e.g. from a city picker).
 */
export function useGeoCity() {
  const [city, setCityState] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(!city);

  useEffect(() => {
    if (city) return;
    let cancelled = false;

    const setCity = (c: string) => {
      if (cancelled) return;
      const slug = c.toLowerCase().trim().replace(/\s+/g, "-");
      setCityState(slug);
      try { localStorage.setItem(KEY, slug); } catch {}
      setLoading(false);
    };

    const fromIp = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return null;
        const j = await res.json();
        return j.city as string | undefined;
      } catch { return null; }
    };

    const fromBrowser = (): Promise<string | null> => new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          try {
            const u = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&zoom=10`;
            const res = await fetch(u, { headers: { "Accept-Language": "en" } });
            if (!res.ok) return resolve(null);
            const j = await res.json();
            const c = j.address?.city || j.address?.town || j.address?.village || j.address?.state_district;
            resolve(c ?? null);
          } catch { resolve(null); }
        },
        () => resolve(null),
        { timeout: 4000, maximumAge: 10 * 60 * 1000 }
      );
    });

    (async () => {
      const browser = await fromBrowser();
      if (cancelled) return;
      if (browser) return setCity(browser);
      const ip = await fromIp();
      if (cancelled) return;
      if (ip) return setCity(ip);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [city]);

  const setCity = (c: string | null) => {
    if (!c) {
      try { localStorage.removeItem(KEY); } catch {}
      setCityState(null);
      return;
    }
    const slug = c.toLowerCase().trim().replace(/\s+/g, "-");
    setCityState(slug);
    try { localStorage.setItem(KEY, slug); } catch {}
  };

  /** Pretty-print a slug back to display form: "new-delhi" → "New Delhi". */
  const display = city
    ? city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : null;

  return { city, displayCity: display, loading, setCity };
}

/** List of major Indian cities for the picker — keep slugs lowercase-hyphenated. */
export const POPULAR_CITIES: { slug: string; label: string }[] = [
  { slug: "mumbai", label: "Mumbai" },
  { slug: "delhi", label: "Delhi" },
  { slug: "bengaluru", label: "Bengaluru" },
  { slug: "hyderabad", label: "Hyderabad" },
  { slug: "chennai", label: "Chennai" },
  { slug: "kolkata", label: "Kolkata" },
  { slug: "pune", label: "Pune" },
  { slug: "ahmedabad", label: "Ahmedabad" },
  { slug: "jaipur", label: "Jaipur" },
  { slug: "lucknow", label: "Lucknow" },
  { slug: "chandigarh", label: "Chandigarh" },
  { slug: "kochi", label: "Kochi" },
  { slug: "goa", label: "Goa" },
  { slug: "indore", label: "Indore" },
  { slug: "bhopal", label: "Bhopal" },
];