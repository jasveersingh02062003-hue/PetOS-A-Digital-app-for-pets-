import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy, IdCard } from "lucide-react";
import { toast } from "sonner";

export const PetIdButton = ({ publicId, petName, microchipId }: { publicId: string; petName: string; microchipId?: string | null }) => {
  if (!publicId) return null;
  const url = `${window.location.origin}/v/${publicId}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl border-hairline gap-1.5 shrink-0">
          <IdCard className="h-3.5 w-3.5" /> Pet ID
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{petName}'s Pet ID</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Permanent ID for your regular vet. They enter it once; you approve, they stay on the care team until you revoke.
          </p>
          <Card className="rounded-2xl border-hairline p-5 flex flex-col items-center bg-card">
            <QRCodeSVG value={url} size={160} bgColor="transparent" fgColor="hsl(var(--foreground))" />
            <div className="font-display text-2xl tracking-[0.25em] mt-4">{publicId}</div>
            <div className="text-xs text-muted-foreground mt-1">Permanent · share with trusted vets only</div>
            {microchipId && (
              <div className="mt-3 pt-3 border-t border-hairline w-full text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Microchip</div>
                <div className="font-mono text-sm mt-0.5">{microchipId}</div>
              </div>
            )}
          </Card>
          <Button
            variant="outline"
            className="w-full rounded-xl border-hairline gap-2"
            onClick={() => { navigator.clipboard.writeText(publicId); toast.success("Pet ID copied"); }}
          >
            <Copy className="h-4 w-4" /> Copy Pet ID
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
