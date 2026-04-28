import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Props = {
  scheduledAt: string;
  /** earliest minutes before scheduledAt that we consider the room "open" */
  openWindowMinutes?: number;
  joining: boolean;
  onJoin: () => void;
};

export function PreCallCheck({ scheduledAt, openWindowMinutes = 5, joining, onJoin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const [hasCam, setHasCam] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 480, height: 360, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setHasCam(stream.getVideoTracks().length > 0);
        setHasMic(stream.getAudioTracks().length > 0);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
        // Audio level meter
        const AC = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 3));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e: any) {
        setError(e?.message || "Camera/mic access denied");
        setHasCam(false);
        setHasMic(false);
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scheduledMs = new Date(scheduledAt).getTime();
  const openAt = scheduledMs - openWindowMinutes * 60 * 1000;
  const canJoin = now >= openAt;
  const minsUntilOpen = Math.max(0, Math.ceil((openAt - now) / 60000));

  const ready = hasCam && hasMic && !error;

  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-3">
      <div className="font-display text-base">Get ready to join</div>

      <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
        {hasCam === null && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        <video ref={videoRef} className="w-full h-full object-cover" playsInline />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-xs">
          {hasCam ? (
            <><VideoIcon className="h-4 w-4 text-leaf" /> <span>Camera ready</span></>
          ) : hasCam === false ? (
            <><VideoOff className="h-4 w-4 text-emergency" /> <span>No camera</span></>
          ) : (
            <><Loader2 className="h-4 w-4 animate-spin" /> <span>Checking…</span></>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {hasMic ? (
            <><Mic className="h-4 w-4 text-leaf" /> <span>Mic ready</span></>
          ) : hasMic === false ? (
            <><MicOff className="h-4 w-4 text-emergency" /> <span>No mic</span></>
          ) : (
            <><Loader2 className="h-4 w-4 animate-spin" /> <span>Checking…</span></>
          )}
        </div>
      </div>

      {hasMic && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Mic level</div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-emergency flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}. Allow camera & mic permissions in your browser, then reload.</span>
        </div>
      )}

      {!canJoin && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-leaf" />
          Room opens in {minsUntilOpen} min — please wait.
        </div>
      )}

      <Button
        onClick={onJoin}
        disabled={!ready || !canJoin || joining}
        className="w-full rounded-full"
        size="lg"
      >
        {joining ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Joining…</>
        ) : !canJoin ? (
          `Available in ${minsUntilOpen} min`
        ) : (
          <><VideoIcon className="h-4 w-4 mr-2" /> Join video call</>
        )}
      </Button>
    </Card>
  );
}