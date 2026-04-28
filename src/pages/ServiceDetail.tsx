import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BadgeCheck, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { BookingSheet } from "@/components/BookingSheet";
import { ReviewList } from "@/components/ReviewList";
import { SubjectRating } from "@/components/SubjectRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { pawIcon } from "@/components/maps/PawMarker";

const ServiceDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: provider, isLoading } = useQuery({
    queryKey: ["service_provider", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="container-app pad-top-safe pt-6">Loading…</div>;
  }
  if (!provider) {
    return (
      <div className="container-app pad-top-safe pt-6">
        <Button variant="ghost" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="mt-4 text-muted-foreground">Provider not found.</p>
      </div>
    );
  }

  return (
    <div className="container-app pad-top-safe pb-32">
      <header className="pt-4 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Provider</h1>
      </header>

      {provider.cover_url && (
        <div className="rounded-2xl overflow-hidden mb-4 aspect-[16/9]">
          <img
            src={provider.cover_url}
            alt={provider.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <Card className="rounded-2xl border-hairline p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl leading-tight">
                {provider.name}
              </h2>
              {provider.verified && (
                <BadgeCheck className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="text-sm text-muted-foreground capitalize mt-1">
              {provider.category}
            </div>
            <div className="mt-1.5">
              <SubjectRating type="provider" id={provider.id} size="sm" />
            </div>
          </div>
          {provider.hourly_rate_inr ? (
            <div className="text-right">
              <div className="text-2xl font-display">
                ₹{provider.hourly_rate_inr}
              </div>
              <div className="text-xs text-muted-foreground">per hour</div>
            </div>
          ) : null}
        </div>

        {provider.city && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {provider.city}
          </div>
        )}
        {provider.contact_phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" /> {provider.contact_phone}
          </div>
        )}

        {provider.bio && (
          <p className="text-sm leading-relaxed pt-2 border-t border-hairline">
            {provider.bio}
          </p>
        )}
      </Card>

      <div className="mt-6">
        <h3 className="font-display text-lg mb-3">Reviews</h3>
        <ReviewList subjectType="provider" subjectId={provider.id} subjectName={provider.name} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-hairline">
        <div className="container-app">
          <Button className="w-full rounded-full h-12" onClick={() => setOpen(true)}>
            Request booking
          </Button>
        </div>
      </div>

      <BookingSheet
        open={open}
        onOpenChange={setOpen}
        providerId={provider.id}
        providerName={provider.name}
      />
    </div>
  );
};

export default ServiceDetail;
