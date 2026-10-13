import { Button, LoadingSpinner, cn } from "@ngriffin_uk/polychat-component-ui";
import { Video } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ClipRecorderPhase } from "./useClipRecorder.js";
import { CLIP_SECONDS } from "./useClipRecorder.js";

function LivePreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full -scale-x-100 object-cover"
    />
  );
}

export function Stage({
  stream,
  phase,
  secondsLeft,
  judging,
  onOpenCamera,
}: {
  stream: MediaStream | null;
  phase: ClipRecorderPhase;
  secondsLeft: number;
  judging: boolean;
  onOpenCamera: () => void;
}) {
  const recording = phase === "recording";
  const elapsed = recording ? (CLIP_SECONDS - secondsLeft) / CLIP_SECONDS : 0;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-[1.75rem] border-[10px] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--color-accent-rose)_22%,transparent),transparent_70%)] shadow-[inset_0_0_60px_rgb(0_0_0/0.35)] transition-colors duration-500",
        recording ? "border-failure/80" : "border-foreground/85",
      )}
    >
      {stream ? (
        <LivePreview stream={stream} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-2xl italic">The stage is dark.</p>
          <Button
            variant="primary"
            icon={<Video size={16} />}
            isLoading={phase === "starting"}
            onClick={onOpenCamera}
          >
            Raise the curtain
          </Button>
          <p className="max-w-xs text-xs text-muted-foreground">
            Camera and microphone. Nothing is kept once the audience has voted.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.45))]" />

      {phase === "countdown" && (
        <div className="absolute inset-0 grid place-items-center">
          <span
            key={secondsLeft}
            className="font-display text-[9rem] leading-none text-canvas italic drop-shadow-[0_6px_30px_rgb(0_0_0/0.6)] motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:zoom-in-150"
          >
            {secondsLeft}
          </span>
        </div>
      )}

      {recording && (
        <>
          <span className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 font-mono text-xs tracking-widest text-white uppercase">
            <span className="size-2 animate-pulse rounded-full bg-failure" />
            Rolling · {secondsLeft}s
          </span>
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
            <div
              className="h-full bg-failure transition-[width] duration-1000 ease-linear"
              style={{ width: `${elapsed * 100}%` }}
            />
          </div>
        </>
      )}

      {judging && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white backdrop-blur-sm">
          <LoadingSpinner />
          <span className="font-display text-xl italic">The audience is deliberating…</span>
        </div>
      )}
    </div>
  );
}
