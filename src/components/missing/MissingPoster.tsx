import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  petName: string;
  species?: string | null;
  breed?: string | null;
  city?: string | null;
  reward?: number | null;
  note?: string | null;
  photoUrl?: string | null;
  shareUrl: string;
  contactPhone?: string | null;
};

export const MissingPoster = ({
  open, onOpenChange, petName, species, breed, city, reward, note, photoUrl, shareUrl, contactPhone,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadPng = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      // Render the poster DOM into an SVG <foreignObject>, then to PNG via canvas.
      const node = ref.current;
      const w = 720;
      const h = 1020;
      const html = node.outerHTML
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // foreignObject approach is unreliable cross-browser with external images;
      // instead, build a canvas directly.
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // Background
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      // Coral header band
      ctx.fillStyle = "#FF6B6B"; ctx.fillRect(0, 0, w, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("MISSING PET", 32, 48);
      ctx.font = "600 18px sans-serif";
      ctx.fillText("Please help us bring them home", 32, 78);

      // Pet photo
      if (photoUrl) {
        try {
          const img = await loadImg(photoUrl);
          drawCover(ctx, img, 32, 120, 656, 420);
        } catch {
          drawPlaceholder(ctx, 32, 120, 656, 420);
        }
      } else {
        drawPlaceholder(ctx, 32, 120, 656, 420);
      }

      // Name + species
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 56px sans-serif";
      ctx.fillText(petName.toUpperCase(), 32, 580);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "#475569";
      const sub = [species, breed].filter(Boolean).join(" · ");
      if (sub) ctx.fillText(sub, 32, 614);

      // Last seen
      ctx.fillStyle = "#0F172A";
      ctx.font = "600 22px sans-serif";
      ctx.fillText(`Last seen: ${city || "—"}`, 32, 660);

      // Note (wrap)
      if (note) {
        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#334155";
        wrapText(ctx, note, 32, 700, 480, 24, 4);
      }

      // Reward chip
      if (reward) {
        ctx.fillStyle = "#FFE9C7";
        roundRect(ctx, 32, 800, 240, 56, 14); ctx.fill();
        ctx.fillStyle = "#92400E";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`₹${reward} REWARD`, 52, 828);
      }

      // QR code (right side)
      const qrSvg = node.querySelector("svg");
      if (qrSvg) {
        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
        const qrImg = await loadImg(svgUrl);
        ctx.drawImage(qrImg, 528, 700, 160, 160);
        ctx.fillStyle = "#475569";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Scan for live updates", 608, 880);
        ctx.textAlign = "start";
      }

      // Footer
      ctx.fillStyle = "#FF6B6B"; ctx.fillRect(0, h - 80, w, 80);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(contactPhone ? `Call: ${contactPhone}` : "See app for contact", 32, h - 50);
      ctx.font = "14px sans-serif";
      ctx.fillText(shareUrl, 32, h - 22);

      // Download
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `missing-${petName.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Poster downloaded");
    } catch (e: any) {
      toast.error("Couldn't generate poster");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6 max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Missing pet poster</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Download and print, or share digitally. Includes a QR code for live updates.
          </p>
        </SheetHeader>

        <div className="my-5 rounded-2xl border border-hairline overflow-hidden bg-card">
          <div ref={ref} className="aspect-[720/1020] bg-white relative">
            <div className="bg-coral text-white px-5 py-3">
              <div className="font-display text-xl leading-tight">MISSING PET</div>
              <div className="text-[11px] opacity-90">Please help us bring them home</div>
            </div>
            <div className="p-3">
              <div className="aspect-[16/10] rounded-xl overflow-hidden bg-muted mb-3">
                {photoUrl ? (
                  <img src={photoUrl} alt={petName} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">No photo</div>
                )}
              </div>
              <div className="font-display text-2xl leading-tight">{petName.toUpperCase()}</div>
              <div className="text-[11px] text-muted-foreground">{[species, breed].filter(Boolean).join(" · ")}</div>
              <div className="text-xs mt-2">Last seen: <strong>{city || "—"}</strong></div>
              {note && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{note}</p>}
              <div className="flex items-end justify-between mt-3">
                <div>
                  {!!reward && (
                    <div className="inline-block text-[11px] font-bold bg-amber-100 text-amber-800 rounded-md px-2 py-1">
                      ₹{reward} REWARD
                    </div>
                  )}
                  {contactPhone && <div className="text-[11px] mt-2">Call: <strong>{contactPhone}</strong></div>}
                </div>
                <div className="text-center">
                  <QRCodeSVG value={shareUrl} size={84} />
                  <div className="text-[9px] text-muted-foreground mt-1">Scan for live updates</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={downloadPng} disabled={downloading} className="rounded-2xl h-12 bg-coral hover:bg-coral/90 text-white">
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download PNG
          </Button>
          <Button variant="outline" className="rounded-2xl h-12" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.save();
  roundRect(ctx, x, y, w, h, 16); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 16); ctx.fillStyle = "#F1F5F9"; ctx.fill();
  ctx.fillStyle = "#94A3B8";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("No photo", x + w / 2, y + h / 2);
  ctx.textAlign = "start";
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y); y += lineHeight; lines++; line = words[i];
      if (lines >= maxLines - 1) {
        // last line, add ellipsis if needed
        let last = "";
        for (let j = i; j < words.length; j++) {
          const t2 = last ? `${last} ${words[j]}` : words[j];
          if (ctx.measureText(t2 + "…").width > maxWidth) break;
          last = t2;
        }
        ctx.fillText((last || "") + "…", x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}