import {
  Button,
  MediaStage,
  MediaTransport,
  mediaPosition,
} from "@ngriffin_uk/polychat-component-ui";
import type { VideoOverviewOutputContent } from "@ngriffin_uk/polychat-schemas";
import { slugify } from "@ngriffin_uk/polychat-utility-core";
import { downloadBlob, useMediaTrack, useObjectUrl } from "@ngriffin_uk/polychat-utility-react";
import { Captions, Download, LoaderCircle, Maximize, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const track = useMediaTrack();
  const narrationUrl = useObjectUrl(narration);
  const [images, setImages] = useState<(ImageBitmap | null)[] | null>(null);
  const isReady = images !== null;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { attach } = track;
  const attachAudio = useCallback(
    (element: HTMLAudioElement | null) => {
      audioRef.current = element;
      attach(element);
    },
    [attach],
  );

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

  const pausedAt = track.playing ? null : track.currentTime;
  const duration = track.duration;

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

  const download = async () => {
    if (!narration) {
      return;
    }

    track.pause();
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
    <MediaStage
      visual={
        <div ref={frameRef} className="@container absolute inset-0 bg-black">
          <canvas
            ref={canvasRef}
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            onClick={track.toggle}
            aria-label={`${title}, video overview`}
            className="block size-full cursor-pointer"
          />
          {!isReady ? (
            <output className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Loading the video
            </output>
          ) : null}
          {!track.playing && isReady && narration ? (
            <button
              type="button"
              onClick={track.toggle}
              aria-label="Play"
              className="absolute inset-0 m-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-105"
            >
              <Play className="ml-1 size-6" />
            </button>
          ) : null}
          {showSubtitles && track.playing && scene ? (
            <p className="pointer-events-none absolute inset-x-[6%] bottom-[5%] line-clamp-2 text-center text-[clamp(0.7rem,2.2cqw,1.05rem)] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
              {scene.narration}
            </p>
          ) : null}
        </div>
      }
      transport={
        <>
          {narrationUrl ? (
            <audio ref={attachAudio} src={narrationUrl} preload="auto">
              <track kind="captions" />
            </audio>
          ) : null}
          <MediaTransport
            playing={track.playing}
            busy={track.buffering}
            disabled={!narration}
            onToggle={track.toggle}
            {...mediaPosition(track)}
            actions={
              <>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={showSubtitles ? "Hide subtitles" : "Show subtitles"}
                  aria-pressed={showSubtitles}
                  onClick={() => setShowSubtitles((current) => !current)}
                >
                  <Captions className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Full screen"
                  onClick={() => void frameRef.current?.requestFullscreen().catch(() => undefined)}
                >
                  <Maximize className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Download video"
                  title="Download video"
                  disabled={!narration || !isReady || exportProgress !== null}
                  onClick={() => void download()}
                >
                  <Download className="size-4" />
                </Button>
              </>
            }
          />
        </>
      }
    >
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
    </MediaStage>
  );
}
