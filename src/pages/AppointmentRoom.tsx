import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Video, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PrescriptionBuilder } from "@/components/vet/PrescriptionBuilder";
import { ShieldAlert, AlertCircle, CheckCircle2 } from "lucide-react";
import { PreCallCheck } from "@/components/vet/PreCallCheck";
import { VisitNotesPanel } from "@/components/vet/VisitNotesPanel";

export default function AppointmentRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [joiningVideo, setJoiningVideo] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: appt } = useQuery({
    queryKey: ["appointment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: pet } = await supabase
        .from("pets")
        .select("name, avatar_url, public_id")
        .eq("id", data.pet_id)
        .maybeSingle();
      let triage: any = null;
      if ((data as any).triage_session_id) {
        const { data: t } = await supabase
          .from("vet_triage_sessions")
          .select("severity, ai_summary, home_care, recommend_vet, transcript, created_at")
          .eq("id", (data as any).triage_session_id)
          .maybeSingle();
        triage = t;
      }
      return { ...data, pet, triage };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["appt-messages", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_messages")
        .select("*")
        .eq("appointment_id", id!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`appt-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointment_messages", filter: `appointment_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["appt-messages", id] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["appointment", id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!body.trim() || !user || !id) return;
    setSending(true);
    const { error } = await supabase.from("appointment_messages").insert({
      appointment_id: id,
      sender_id: user.id,
      body: body.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
  };

  const joinVideo = async () => {
    if (!id) return;
    setJoiningVideo(true);
    const { data, error } = await supabase.functions.invoke("create-video-room", {
      body: { appointmentId: id },
    });
    setJoiningVideo(false);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Failed");
    setVideoUrl(`${data.url}?t=${data.token}`);
    const joinedAt = Date.now();
    setCallStartedAt(joinedAt);

    // Auto-mark in_progress + stamp started_at when vet joins (or if confirmed and owner joins)
    try {
      const isVetJoining = appt && user?.id === appt.vet_id;
      const updates: Record<string, any> = {};
      if (
        appt &&
        (appt.status === "confirmed" || appt.status === "requested") &&
        isVetJoining
      ) {
        updates.status = "in_progress";
      }
      if (appt && !appt.started_at) {
        updates.started_at = new Date(joinedAt).toISOString();
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("appointments").update(updates as any).eq("id", id);
      }
    } catch (_) { /* best effort */ }
  };

  const isVet = appt && user?.id === appt.vet_id;

  const updateStatus = async (status: string) => {
    if (!id) return;
    const updates: Record<string, any> = { status };
    if (status === "in_progress" && appt && !appt.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (status === "completed" && appt) {
      const endIso = new Date().toISOString();
      updates.ended_at = endIso;
      const startMs = appt.started_at
        ? new Date(appt.started_at).getTime()
        : callStartedAt ?? new Date(endIso).getTime();
      updates.actual_duration_min = Math.max(
        0,
        Math.round((new Date(endIso).getTime() - startMs) / 60000),
      );
    }
    const { error } = await supabase.from("appointments").update(updates as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
  };

  if (!appt) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const canShowLobby =
    appt.mode === "video" &&
    !videoUrl &&
    appt.status !== "completed" &&
    appt.status !== "cancelled";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {appt.pet?.name || "Appointment"}
          </div>
          <div className="text-xs text-muted-foreground">
            {appt.mode} · {new Date(appt.scheduled_at).toLocaleString()}
          </div>
        </div>
        <Badge variant="secondary">{appt.status}</Badge>
      </header>

      {appt.mode === "video" && (
        <div className="px-4 pt-3">
          {videoUrl ? (
            <div className="rounded-2xl overflow-hidden border-hairline border bg-black aspect-video">
              <iframe
                src={videoUrl}
                allow="camera; microphone; fullscreen; speaker; display-capture"
                className="w-full h-full"
              />
            </div>
          ) : appt.status === "completed" ? (
            <Card className="rounded-2xl border-hairline p-4 text-center">
              <CheckCircle2 className="h-6 w-6 text-leaf mx-auto mb-2" />
              <div className="font-medium text-sm">Consultation completed</div>
              {appt.actual_duration_min != null && (
                <div className="text-xs text-muted-foreground mt-1">
                  Call duration: {appt.actual_duration_min} min
                </div>
              )}
            </Card>
          ) : (
            <PreCallCheck
              scheduledAt={appt.scheduled_at}
              joining={joiningVideo}
              onJoin={joinVideo}
            />
          )}
        </div>
      )}

      {appt.mode === "in_clinic" && (
        <Card className="mx-4 mt-3 p-4 rounded-2xl border-hairline">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 mt-0.5 text-primary" />
            <div className="flex-1">
              <div className="font-medium text-sm">In-clinic visit</div>
              <div className="text-xs text-muted-foreground mt-1">
                Use chat below to confirm details with the clinic.
              </div>
            </div>
          </div>
        </Card>
      )}

      {isVet && appt.status !== "completed" && appt.status !== "cancelled" && (
        <div className="px-4 pt-3 flex gap-2 flex-wrap">
          {appt.status === "requested" && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => updateStatus("confirmed")}>Confirm</Button>
          )}
          {appt.status === "confirmed" && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => updateStatus("in_progress")}>Start</Button>
          )}
          {appt.status === "in_progress" && (
            <Button size="sm" className="rounded-full" onClick={() => updateStatus("completed")}>Complete</Button>
          )}
        </div>
      )}

      {isVet && appt.pet_id && (
        <PrescriptionBuilder appointmentId={appt.id} petId={appt.pet_id} ownerId={appt.owner_id} />
      )}

      {isVet && (
        <VisitNotesPanel appointmentId={appt.id} initialNotes={(appt as any).vet_visit_notes} />
      )}

      {isVet && appt.triage && (
        <TriageSummaryCard triage={appt.triage} />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages?.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">No messages yet</div>
        )}
        {messages?.map((m: any) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                mine ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {m.body}
                <div className={`text-[10px] mt-1 opacity-70`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-background border-t border-hairline p-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Type a message…"
          className="rounded-full"
        />
        <Button onClick={send} disabled={sending || !body.trim()} size="icon" className="rounded-full shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const TONE: Record<string, { bg: string; text: string; ring: string; icon: any; label: string }> = {
  mild:     { bg: "bg-leaf/10",      text: "text-leaf",      ring: "ring-leaf/30",      icon: CheckCircle2, label: "AI: Mild" },
  moderate: { bg: "bg-amber/15",     text: "text-amber",     ring: "ring-amber/30",     icon: AlertCircle,  label: "AI: Moderate" },
  severe:   { bg: "bg-emergency/12", text: "text-emergency", ring: "ring-emergency/30", icon: ShieldAlert,  label: "AI: Severe" },
};

function TriageSummaryCard({ triage }: { triage: any }) {
  const tone = TONE[triage.severity as string] ?? TONE.moderate;
  const Icon = tone.icon;
  const transcript: { role: string; content: string }[] = Array.isArray(triage.transcript) ? triage.transcript : [];
  return (
    <Card className={`mx-4 mt-3 p-4 rounded-2xl border-hairline ring-1 ${tone.ring} ${tone.bg}`}>
      <div className={`flex items-center gap-2 ${tone.text} font-semibold text-sm`}>
        <Icon className="h-4 w-4" /> {tone.label}{triage.recommend_vet ? " · vet review recommended" : ""}
      </div>
      {triage.ai_summary && (
        <p className="text-sm text-foreground mt-2 leading-relaxed">{triage.ai_summary}</p>
      )}
      {!!triage.home_care?.length && (
        <ul className="mt-2 space-y-1">
          {triage.home_care.map((h: string, i: number) => (
            <li key={i} className="text-xs text-foreground/80">• {h}</li>
          ))}
        </ul>
      )}
      {transcript.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show owner ↔ AI transcript ({transcript.length})</summary>
          <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
            {transcript.map((m, i) => (
              <div key={i} className="text-[11px]">
                <span className="font-semibold capitalize text-muted-foreground">{m.role}: </span>
                <span className="text-foreground/80">{m.content}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
