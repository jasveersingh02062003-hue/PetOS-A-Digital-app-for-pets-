import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export const SettingsLayout = ({
  title, subtitle, children, onSave, saving, savable = true,
}: {
  title: string; subtitle?: string; children: ReactNode;
  onSave?: () => void; saving?: boolean; savable?: boolean;
}) => {
  const nav = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="font-display text-lg leading-tight">{title}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
      </header>
      <main className="container-app flex-1 py-6 space-y-5">{children}</main>
      {savable && onSave && (
        <footer className="container-app sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 pt-4 pb-6">
          <Button onClick={onSave} disabled={saving} size="lg" className="w-full rounded-xl h-12">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </footer>
      )}
    </div>
  );
};
