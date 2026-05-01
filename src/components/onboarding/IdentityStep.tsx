import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepShell } from "@/components/onboarding/StepShell";
import { Check, Loader2, MapPin, AlertCircle, Camera } from "lucide-react";
import { toast } from "sonner";
import { slugifyHandle, validateHandle, isHandleAvailable } from "@/lib/handle";
import { uploadImageWithVariants } from "@/lib/uploadImage";
import { track } from "@/lib/analytics";

type Props = {
  initial: {
    fullName?: string | null;
    handle?: string | null;
    city?: string | null;
    language?: string | null;
    units?: { weight: "kg" | "lb"; temp: "c" | "f" } | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  onComplete: () => void;
};

/**
 * Chapter 0 — universal identity step (everyone sees this once).
 * Collects: full name, unique @handle (live availability), city, language, units.
 * Persists to profiles, then advances.
 */
export const IdentityStep = ({ initial, onComplete }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => { void track("onboarding_step", { step: "identity", action: "started" }); }, []);
  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(!!initial.handle);
  const [city, setCity] = useState(initial.city ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [language, setLanguage] = useState(initial.language ?? "en");
  // Units are inferred from the user's locale (US → lb/°F, everywhere else → kg/°C)
  // and editable later in Settings — no point cluttering the welcome screen.
  const inferredUnits = useMemo<{ weight: "kg" | "lb"; temp: "c" | "f" }>(() => {
    if (initial.units) return initial.units;
    try {
      const loc = (typeof navigator !== "undefined" && navigator.language) || "en";
      const region = (loc.split("-")[1] || "").toUpperCase();
      const imperial = ["US", "LR", "MM"].includes(region);
      return imperial ? { weight: "lb", temp: "f" } : { weight: "kg", temp: "c" };
    } catch {
      return { weight: "kg", temp: "c" };
    }
  }, [initial.units]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const onPickAvatar = async (f: File | null) => {
    if (!f) return;
    setAvatarUploading(true);
    try {
      const v = await uploadImageWithVariants(f, "user-avatars");
      setAvatarUrl(v.full);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  // Auto-suggest handle from name/email if user hasn't typed one yet.
  useEffect(() => {
    if (handleTouched) return;
    const seed = fullName || initial.email || "";
    if (seed) setHandle(slugifyHandle(seed));
  }, [fullName, initial.email, handleTouched]);

  // ─── Live handle availability check ───────────────────────────────────────
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useMemo(() => validateHandle(handle), [handle]);

  useEffect(() => {
    if (handleError) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await isHandleAvailable(handle, user?.id);
      setAvailable(ok);
      setChecking(false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handle, handleError, user?.id]);

  const detectCity = () => {
    if (!navigator.geolocation) return toast.error("Location not available");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const j = await r.json();
          const c = j.address?.city || j.address?.town || j.address?.village || j.address?.state_district;
          if (c) { setCity(c); toast.success(`Set city to ${c}`); }
        } catch {}
      },
      () => toast.error("Location permission denied")
    );
  };

  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!user) return;
    if (!fullName.trim()) return toast.error("Add your name");
    if (handleError) return toast.error(handleError);
    if (available === false) return toast.error("That handle is taken");
    if (!city.trim()) return toast.error("Add your city");
    setSaving(true);
    try {
      // Final uniqueness check (race-safe via DB unique index — catch & report)
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        handle: handle.trim().toLowerCase(),
        city: city.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        language,
        units: inferredUnits,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      } as any, { onConflict: "id" });
      if (error) {
        if (error.code === "23505" || /handle/i.test(error.message)) {
          setAvailable(false);
          throw new Error("That handle is taken");
        }
        throw error;
      }
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      void track("onboarding_step", {
        step: "identity",
        action: "completed",
        has_avatar: !!avatarUrl,
        language,
        units: inferredUnits.weight,
      });
      onComplete();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const nextDisabled =
    !fullName.trim() || !!handleError || available === false || checking || !city.trim() || saving;

  return (
    <StepShell
      step={0}
      total={3}
      title="Welcome to Petos"
      subtitle="Pick how people will find you. You can change everything later in settings."
      onNext={submit}
      loading={saving}
      nextDisabled={nextDisabled}
      nextLabel="Continue"
      showCoach={false}
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <label className="relative h-24 w-24 rounded-full bg-muted overflow-hidden cursor-pointer flex items-center justify-center border-2 border-dashed border-hairline hover:border-primary transition">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
              disabled={avatarUploading}
            />
            {avatarUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Your photo" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            )}
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground text-center -mt-3">
          {avatarUrl ? "Tap photo to change" : "Add a profile photo (optional)"}
        </p>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="h-12 rounded-xl border-hairline bg-card"
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">@handle</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              value={handle}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""));
              }}
              placeholder="yourhandle"
              className="h-12 rounded-xl border-hairline bg-card pl-7 pr-10"
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : handleError ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : available === true ? (
                <Check className="h-4 w-4 text-primary" />
              ) : available === false ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : null}
            </div>
          </div>
          <p className={`text-[11px] ${handleError || available === false ? "text-destructive" : "text-muted-foreground"}`}>
            {handleError
              ? handleError
              : available === false
              ? "That handle is taken — try another"
              : `petos.app/@${handle || "yourhandle"} — your public address`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">City</Label>
          <div className="flex gap-2">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-12 rounded-xl border-hairline bg-card flex-1"
              placeholder="Your city"
              maxLength={80}
            />
            <Button type="button" variant="outline" onClick={detectCity} className="h-12 rounded-xl border-hairline px-3">
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Powers nearby vets, services, mates and missing-pet alerts.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
              <SelectItem value="ta">தமிழ்</SelectItem>
              <SelectItem value="te">తెలుగు</SelectItem>
              <SelectItem value="mr">मराठी</SelectItem>
              <SelectItem value="bn">বাংলা</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Units ({inferredUnits.weight} · °{inferredUnits.temp.toUpperCase()}) auto-detected — change later in Settings.
          </p>
        </div>
      </div>
    </StepShell>
  );
};

export default IdentityStep;
