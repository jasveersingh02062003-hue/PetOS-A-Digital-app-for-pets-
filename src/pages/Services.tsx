import { Card } from "@/components/ui/card";
import { Footprints, Hotel, Scissors, ShoppingBag } from "lucide-react";

const Services = () => {
  const items = [
    { icon: Footprints, label: "Walking", desc: "Verified PetPals near you" },
    { icon: Hotel, label: "Boarding", desc: "Daycare & overnight stays" },
    { icon: Scissors, label: "Grooming", desc: "At-salon or at-home" },
    { icon: ShoppingBag, label: "Shop", desc: "Food, treats, accessories" },
  ];
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-6">
        <h1 className="font-display text-3xl">Services</h1>
      </header>
      <div className="space-y-3">
        {items.map(({ icon: Icon, label, desc }) => (
          <Card key={label} className="rounded-2xl border-hairline bg-card shadow-none p-5 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="bg-primary-soft rounded-2xl h-12 w-12 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg leading-tight">{label}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Services;
