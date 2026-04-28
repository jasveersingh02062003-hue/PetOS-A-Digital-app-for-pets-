import { Button } from "@/components/ui/button";
import { useMyRsvp, useSetRsvp, type RsvpStatus } from "@/hooks/useMeetups";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { Check, X, HelpCircle } from "lucide-react";
import { haptic } from "@/lib/haptics";

export const RsvpButton = ({ meetupId }: { meetupId: string }) => {
  const { user } = useAuth();
  const { data: pets } = usePets();
  const { data: rsvp } = useMyRsvp(meetupId);
  const set = useSetRsvp();

  if (!user) return null;
  const status = rsvp?.status as RsvpStatus | undefined;
  const firstPet = pets?.[0]?.id;

  const Btn = ({ value, icon: Icon, label }: { value: RsvpStatus; icon: any; label: string }) => (
    <Button
      size="sm"
      variant={status === value ? "default" : "outline"}
      onClick={() => { haptic(10); set.mutate({ meetupId, status: value, petId: firstPet }); }}
      disabled={set.isPending}
      className="rounded-full flex-1"
    >
      <Icon className="h-4 w-4 mr-1.5" />
      {label}
    </Button>
  );

  return (
    <div className="flex gap-2">
      <Btn value="going" icon={Check} label="Going" />
      <Btn value="maybe" icon={HelpCircle} label="Maybe" />
      <Btn value="declined" icon={X} label="Pass" />
    </div>
  );
};
