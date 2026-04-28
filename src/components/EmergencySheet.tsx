import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Siren, MessageSquare, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const EmergencySheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const nav = useNavigate();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-emergency/10 rounded-full p-2">
              <Siren className="h-5 w-5 text-emergency" strokeWidth={1.75} />
            </div>
            <SheetTitle className="font-display text-2xl">Emergency</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Get instant guidance from the AI assistant or connect with a vet on call.
          </p>
        </SheetHeader>
        <div className="space-y-3 mt-6 pb-8">
          <Button
            onClick={() => { onOpenChange(false); nav("/ai"); }}
            className="w-full h-14 justify-start gap-3 rounded-2xl"
            size="lg"
          >
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
            <div className="text-left">
              <div className="font-medium">Ask the AI assistant</div>
              <div className="text-xs opacity-80">Triage symptoms in seconds</div>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); nav("/health"); }}
            className="w-full h-14 justify-start gap-3 rounded-2xl"
            size="lg"
          >
            <Phone className="h-5 w-5" strokeWidth={1.75} />
            <div className="text-left">
              <div className="font-medium">Connect to a vet</div>
              <div className="text-xs opacity-70">Tele-consult with full pet history</div>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
