import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { uploadImageWithVariants } from "@/lib/uploadImage";

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
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
    setUploading(true);
    try {
      const v = await uploadImageWithVariants(file, bucket as any);
      // Use the `feed` size by default — callers that need the original full
      // image can read it from the `full` URL via the surrounding state.
      onChange(v.feed);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
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
