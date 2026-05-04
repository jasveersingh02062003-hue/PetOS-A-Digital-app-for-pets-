import { useParams } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";

export default function CareGuide() {
  const { "*": path } = useParams();
  
  useSeo({
    title: "Pet Care Guides | Petos",
    description: "Expert advice and care guides for your pets.",
  });

  return (
    <div className="p-4 safe-area-pt animate-fade-in pb-24">
      <h1 className="text-2xl font-bold mb-4">Pet Care Guide</h1>
      <p className="text-muted-foreground mb-8">
        Topic: {path || "General Care"}
      </p>
      <p>Content coming soon.</p>
    </div>
  );
}
