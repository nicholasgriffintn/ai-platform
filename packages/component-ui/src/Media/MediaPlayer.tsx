import {
  useCaptionTrack,
  useMediaLoudness,
  useMediaTrack,
  type MediaTrack,
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
  levelVoice?: boolean;
  showTranscriptList?: boolean;
  notice?: ReactNode;
  actions?: ReactNode;
  className?: string;
  onPlayingChange?: (playing: boolean) => void;
  track?: MediaTrack;
  hostsMedia?: boolean;
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
  track: sharedTrack,
  hostsMedia = true,
}: MediaPlayerProps) {
  const ownTrack = useMediaTrack();
  const track = sharedTrack ?? ownTrack;
  const { attach, playing, buffering, currentTime, duration, toggle, seek, play } = track;
  const attachAudio = useMediaLoudness(attach, levelVoice && kind === "audio");
  const activeIndex = transcript ? currentTranscriptIndex(transcript, currentTime, duration) : -1;
  const started = playing || currentTime > 0;
  const subtitle =
    transcript && started && (kind === "audio" || !captionsVtt)
      ? transcript.segments[activeIndex]
      : undefined;
  const speakers = transcript?.speakers ?? {};
  const captionTrackRef = useCaptionTrack(captionsVtt);

  useEffect(() => onPlayingChange?.(playing), [onPlayingChange, playing]);

  const visual =
    layout === "compact" ? null : (
      <>
        {kind === "video" && src ? (
          <video
            ref={attach}
            src={src}
            title={title}
            preload="metadata"
            playsInline
            crossOrigin={crossOrigin}
            onClick={toggle}
            className="absolute inset-0 size-full cursor-pointer bg-black object-contain"
          >
            <track ref={captionTrackRef} kind="captions" srcLang="en" label="Captions" default />
          </video>
        ) : (
          <MediaWaveArt
            playing={playing}
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
          {kind === "audio" && src && hostsMedia ? (
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
            playing={playing}
            busy={buffering}
            disabled={!src}
            onToggle={toggle}
            actions={actions}
            {...mediaPosition({ currentTime, duration, seek })}
          />
        </>
      }
    >
      {transcript && showTranscriptList && transcript.segments.length > 0 && layout === "stage" ? (
        <MediaTranscriptList
          transcript={transcript}
          activeIndex={started ? activeIndex : -1}
          onSeek={(seconds) => {
            seek(seconds);
            play();
          }}
        />
      ) : null}
    </MediaStage>
  );
}
