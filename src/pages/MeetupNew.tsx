import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateMeetup } from "@/hooks/useMeetups";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const MeetupNew = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const create = useCreateMeetup();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(profile?.city ?? "");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [capacity, setCapacity] = useState("");

  const submit = async () => {
    if (!title.trim() || !date) return;
    const starts_at = new Date(`${date}T${time}`).toISOString();
    const m = await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      city: city.trim() || undefined,
      venue: venue.trim() || undefined,
      starts_at,
      capacity: capacity ? Number(capacity) : undefined,
    } as any);
    nav(`/meetups/${m.id}`);
  };

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-2xl">Host a meetup</h1>
      </header>

      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday morning dog park hang" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bring water, treats, and a happy pup" rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
        </div>
        <div>
          <Label>Venue</Label>
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Cubbon Park, Gate 4" />
        </div>
        <div>
          <Label>Capacity (optional)</Label>
          <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="20" />
        </div>
        <Button onClick={submit} disabled={create.isPending || !title.trim() || !date} className="w-full rounded-full">
          {create.isPending ? "Creating…" : "Create meetup"}
        </Button>
      </div>
    </div>
  );
};

export default MeetupNew;
