import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

const AiChat = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="font-display text-lg leading-tight">AI assistant</div>
          <div className="text-xs text-muted-foreground">Coming next stage</div>
        </div>
      </header>
      <div className="flex-1 container-app flex flex-col items-center justify-center text-center py-12">
        <div className="bg-primary-soft rounded-full p-4 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="font-display text-2xl">Real AI is wired up next</div>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          The chat with your pet's full health context lives here. We'll build it in the next stage.
        </p>
      </div>
    </div>
  );
};

export default AiChat;
