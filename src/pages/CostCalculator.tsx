import { useSeo } from "@/hooks/useSeo";

export default function CostCalculator() {
  useSeo({
    title: "Pet Cost Calculator | Petos",
    description: "Estimate the lifetime cost of owning a pet. Calculate food, vet bills, grooming, and more.",
  });

  return (
    <div className="p-4 safe-area-pt animate-fade-in pb-24">
      <h1 className="text-2xl font-bold mb-4">Pet Cost Calculator</h1>
      <p className="text-muted-foreground mb-8">
        Estimate the financial commitment of a new pet. (Coming soon)
      </p>
    </div>
  );
}
