import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";

export const PhotoGallery = ({ photos, alt }: { photos: string[]; alt: string }) => {
  const [idx, setIdx] = useState(0);
  if (!photos.length) {
    return (
      <div className="aspect-[4/3] rounded-2xl bg-muted overflow-hidden mb-4 grid place-items-center text-muted-foreground">
        <Heart className="h-10 w-10" />
      </div>
    );
  }
  const prev = () => setIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === photos.length - 1 ? 0 : i + 1));
  return (
    <div className="relative aspect-[4/3] rounded-2xl bg-muted overflow-hidden mb-4">
      <img src={photos[idx]} alt={alt} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card/80 backdrop-blur grid place-items-center shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card/80 backdrop-blur grid place-items-center shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-card" : "w-1.5 bg-card/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};