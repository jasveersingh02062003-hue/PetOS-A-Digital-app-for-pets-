import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  aspect?: "square" | "video" | "tall";
  label?: string;
};

const aspectClass = {
  square: "aspect-square",
  video: "aspect-[16/9]",
  tall: "aspect-[3/4]",
};

export const ImageUpload = ({
  value,
  onChange,
  bucket = "marketplace",
  aspect = "square",
  label = "Add image",
}: Props) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!user) return toast.error("Sign in first");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className={`relative rounded-2xl overflow-hidden border border-hairline ${aspectClass[aspect]}`}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 rounded-full h-8 w-8"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full ${aspectClass[aspect]} rounded-2xl border-2 border-dashed border-hairline flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
