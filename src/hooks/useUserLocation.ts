import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Coords = { lat: number; lng: number; source: "browser" | "profile" };

/**
 * Best-effort current location:
 *   1. Browser geolocation (silent: only fires if permission already granted).
 *   2. Falls back to the lat/lng saved on the user's profile.
 */
export function useUserLocation() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fromProfile = async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("lat,lng")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.lat && data?.lng) {
        return { lat: Number(data.lat), lng: Number(data.lng), source: "profile" as const };
      }
      return null;
    };

    const tryBrowser = () =>
      new Promise<Coords | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, source: "browser" }),
          () => resolve(null),
          { timeout: 6000, maximumAge: 5 * 60 * 1000 }
        );
      });

    (async () => {
      const browser = await tryBrowser();
      if (cancelled) return;
      if (browser) {
        setCoords(browser);
        setLoading(false);
        return;
      }
      const profile = await fromProfile();
      if (cancelled) return;
      if (profile) setCoords(profile);
      else setError("Location unavailable. Set your city in Settings or allow location.");
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const requestBrowser = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, source: "browser" });
        setError(null);
        setLoading(false);
      },
      (e) => { setError(e.message); setLoading(false); },
      { timeout: 10_000 }
    );
  };

  return { coords, loading, error, requestBrowser };
}