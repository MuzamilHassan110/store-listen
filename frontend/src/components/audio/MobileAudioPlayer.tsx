import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { Button } from "../ui/button";

function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

type Props = {
  src: string;
  duration?: number;
};

export function MobileAudioPlayer({ src, duration = 0 }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rate, setRate] = useState(1);
  const [skipSilence, setSkipSilence] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (!playing || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "StoreListen recording",
      artist: "StoreListen",
    });
    navigator.mediaSession.setActionHandler("play", () => void audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
  }, [playing]);

  useEffect(() => {
    if (!skipSilence || !audioRef.current) return;
    let frame = 0;
    const audio = audioRef.current;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        const avg = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
        if (avg < 2.2 && !audio.paused) {
          audio.currentTime = Math.min(audio.duration || duration, audio.currentTime + 0.6);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(frame);
        void ctx.close();
        analyserRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [skipSilence, duration]);

  async function toggle(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" className="min-h-11 min-w-11" onClick={() => void toggle()}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={current}
          onChange={(e) => {
            const value = Number(e.target.value);
            setCurrent(value);
            if (audioRef.current) audioRef.current.currentTime = value;
          }}
          className="min-h-11 min-w-[160px] flex-1"
        />
        <span className="text-sm text-slate-400">
          {formatClock(current)} / {formatClock(duration)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 1.25, 1.5, 2].map((value) => (
          <Button key={value} size="sm" variant={rate === value ? "primary" : "secondary"} onClick={() => setRate(value)}>
            {value}x
          </Button>
        ))}
        <Button size="sm" variant={skipSilence ? "primary" : "secondary"} onClick={() => setSkipSilence((value) => !value)}>
          Skip silence {skipSilence ? "on" : "off"}
        </Button>
        <a href={src} download className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm">
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}
