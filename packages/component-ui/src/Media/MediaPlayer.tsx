import {
  useCaptionTrack,
  useMediaLoudness,
  useMediaTrack,
} from "@ngriffin_uk/polychat-utility-react";
import { useEffect, type ReactNode } from "react";

import type { MediaTranscript } from "./media-status";
import { MediaStage } from "./MediaStage";
import { currentTranscriptIndex, MediaTranscriptList } from "./MediaTranscriptList";
import { mediaPosition, MediaTransport } from "./MediaTransport";
import { MediaWaveArt } from "./MediaWaveArt";

export interface MediaPlayerProps {
  kind: "audio" | "video";
  src: string | null;
  title: string;
  layout?: "stage" | "compact";
  crossOrigin?: "anonymous" | "use-credentials";
  art?: string | null;
  artBackground?: string;
  captionsVtt?: string | null;
  transcript?: MediaTranscript;
  /** Evens out and lifts a spoken recording. Needs CORS-clean audio. */
  levelVoice?: boolean;
  showTranscriptList?: boolean;
  notice?: ReactNode;
  actions?: ReactNode;
  className?: string;
  onPlayingChange?: (playing: boolean) => void;
}

export function MediaPlayer({
  kind,
  src,
  title,
  layout = "stage",
  crossOrigin,
  art,
  artBackground,
  captionsVtt = null,
  transcript,
  levelVoice = false,
  showTranscriptList = true,
  notice,
  actions,
  className,
  onPlayingChange,
}: MediaPlayerProps) {
  const track = useMediaTrack();
  const attachAudio = useMediaLoudness(track.attach, levelVoice && kind === "audio");
  const activeIndex = transcript
    ? currentTranscriptIndex(transcript, track.currentTime, track.duration)
    : -1;
  const started = track.playing || track.currentTime > 0;
  const subtitle =
    transcript && started && (kind === "audio" || !captionsVtt)
      ? transcript.segments[activeIndex]
      : undefined;
  const speakers = transcript?.speakers ?? {};
  const captionTrackRef = useCaptionTrack(captionsVtt);

  useEffect(() => onPlayingChange?.(track.playing), [onPlayingChange, track.playing]);

  const visual =
    layout === "compact" ? null : (
      <>
        {kind === "video" && src ? (
          <video
            ref={track.attach}
            src={src}
            title={title}
            preload="metadata"
            playsInline
            crossOrigin={crossOrigin}
            onClick={track.toggle}
            className="absolute inset-0 size-full cursor-pointer bg-black object-contain"
          >
            <track ref={captionTrackRef} kind="captions" srcLang="en" label="Captions" default />
          </video>
        ) : (
          <MediaWaveArt
            playing={track.playing}
            image={art}
            background={artBackground}
            crossOrigin={crossOrigin}
          />
        )}
        {subtitle ? (
          <p className="absolute inset-x-6 bottom-5 text-center text-sm leading-snug text-balance text-white drop-shadow sm:text-base">
            {subtitle.speaker ? (
              <span className="font-semibold text-white/80">
                {speakers[subtitle.speaker] ?? subtitle.speaker}:{" "}
              </span>
            ) : null}
            {subtitle.text}
          </p>
        ) : null}
        {notice}
      </>
    );

  return (
    <MediaStage
      className={className}
      visual={visual}
      transport={
        <>
          {kind === "audio" && src ? (
            <audio
              ref={attachAudio}
              src={src}
              title={title}
              preload="metadata"
              crossOrigin={crossOrigin}
            >
              <track ref={captionTrackRef} kind="captions" srcLang="en" label="Captions" default />
            </audio>
          ) : null}
          <MediaTransport
            playing={track.playing}
            busy={track.buffering}
            disabled={!src}
            onToggle={track.toggle}
            actions={actions}
            {...mediaPosition(track)}
          />
        </>
      }
    >
      {transcript && showTranscriptList && transcript.segments.length > 0 && layout === "stage" ? (
        <MediaTranscriptList
          transcript={transcript}
          activeIndex={started ? activeIndex : -1}
          onSeek={(seconds) => {
            track.seek(seconds);
            track.play();
          }}
        />
      ) : null}
    </MediaStage>
  );
}
