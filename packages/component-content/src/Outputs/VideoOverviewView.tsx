import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { VideoOverviewOutputContent } from "@ngriffin_uk/polychat-schemas";
import { formatDuration, slugify } from "@ngriffin_uk/polychat-utility-core";
import { downloadBlob } from "@ngriffin_uk/polychat-utility-react";
import { Captions, Download, LoaderCircle, Maximize, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  drawVideoFrame,
  loadVideoImages,
  recordVideo,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./video-render";

export interface VideoOverviewViewProps {
  title: string;
  content: VideoOverviewOutputContent;
  narration: Blob | null;
  sceneImages: readonly (Blob | null)[];
  isLoading?: boolean;
}

export function VideoOverviewView({
  title,
  content,
  narration,
  sceneImages,
  isLoading = false,
}: VideoOverviewViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [images, setImages] = useState<(ImageBitmap | null)[] | null>(null);
  const isReady = images !== null;
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (isLoading) {
      return undefined;
    }

    void loadVideoImages(sceneImages).then((loaded) => {
      if (!cancelled) {
        setImages(loaded);
      }

      return loaded;
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, sceneImages]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !narration) {
      return undefined;
    }

    const url = URL.createObjectURL(narration);

    audio.src = url;

    return () => {
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [narration]);

  const pausedAt = isPlaying ? null : seconds;

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");

    if (!images || !context) {
      return undefined;
    }

    const render = () => {
      const audio = audioRef.current;

      setSceneIndex(
        drawVideoFrame(context, {
          content,
          title,
          images,
          seconds: audio?.currentTime ?? pausedAt ?? 0,
          durationSeconds: audio?.duration || duration,
        }),
      );
      setSeconds(audio?.currentTime ?? 0);
    };

    render();

    if (pausedAt !== null) {
      return undefined;
    }

    let frame = requestAnimationFrame(function loop() {
      render();
      frame = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(frame);
  }, [content, duration, images, pausedAt, title]);

  const toggle = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = value;
      setSeconds(value);
    }
  };

  const download = async () => {
    if (!narration) {
      return;
    }

    audioRef.current?.pause();
    setExportError(null);
    setExportProgress(0);

    try {
      const blob = await recordVideo({
        input: { content, title, images: images ?? [] },
        narration,
        onProgress: setExportProgress,
      });

      downloadBlob(`${slugify(title) || "video-overview"}.webm`, blob);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The video could not be rendered");
    } finally {
      setExportProgress(null);
    }
  };

  const scene = content.scenes[sceneIndex];

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="@container relative w-full overflow-hidden rounded-xl bg-black shadow-sm"
      >
        <canvas
          ref={canvasRef}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          onClick={toggle}
          aria-label={`${title}, video overview`}
          className="block aspect-video w-full cursor-pointer"
        />
        {!isReady ? (
          <output className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading the video
          </output>
        ) : null}
        {!isPlaying && isReady && narration ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Play"
            className="absolute inset-0 m-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-105"
          >
            <Play className="ml-1 size-6" />
          </button>
        ) : null}
        {showSubtitles && isPlaying && scene ? (
          <p className="pointer-events-none absolute inset-x-[6%] bottom-[5%] line-clamp-2 text-center text-[clamp(0.7rem,2.2cqw,1.05rem)] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
            {scene.narration}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!narration}
          onClick={toggle}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDuration(seconds) || "0:00"} / {formatDuration(duration) || "0:00"}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={seconds}
          disabled={!narration}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek"
          className="mx-1 min-w-0 flex-1 accent-primary"
        />
        <Button
          variant="icon"
          aria-label={showSubtitles ? "Hide subtitles" : "Show subtitles"}
          aria-pressed={showSubtitles}
          onClick={() => setShowSubtitles((current) => !current)}
          className={cn(showSubtitles && "text-foreground")}
        >
          <Captions className="size-4" />
        </Button>
        <Button
          variant="icon"
          aria-label="Full screen"
          onClick={() => void frameRef.current?.requestFullscreen().catch(() => undefined)}
        >
          <Maximize className="size-4" />
        </Button>
        <Button
          variant="icon"
          aria-label="Download video"
          title="Download video"
          disabled={!narration || !isReady || exportProgress !== null}
          onClick={() => void download()}
        >
          <Download className="size-4" />
        </Button>
      </div>
      {exportProgress !== null ? (
        <output className="block text-xs text-muted-foreground">
          Rendering the video in real time, {Math.round(exportProgress * 100)}% done. Keep this tab
          open.
        </output>
      ) : exportError ? (
        <p className="text-xs text-failure" role="alert">
          {exportError}
        </p>
      ) : !narration ? (
        <p className="text-xs text-muted-foreground">The narration is still being recorded.</p>
      ) : null}
      {narration ? (
        <audio
          ref={audioRef}
          preload="auto"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      ) : null}
    </div>
  );
}
