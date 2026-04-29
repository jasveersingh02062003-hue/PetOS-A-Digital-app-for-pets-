import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "petos:geo";

export type GeoPoint = { lat: number; lng: number; ts: number };

export function useGeolocation() {
  const [coords, setCoords] = useState<GeoPoint | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GeoPoint;
      // Stale after 1 hour, but still usable on first paint
      return parsed;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Location not supported by this browser");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
        };
        setCoords(point);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(point)); } catch {}
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Could not get location");
        setLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { coords, loading, error, request, clear };
}
