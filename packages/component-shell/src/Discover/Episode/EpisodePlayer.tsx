import {
  Button,
  MediaNotice,
  MediaNoticeAction,
  MediaStage,
  MediaTrackList,
  MediaTransport,
  mediaPosition,
} from "@ngriffin_uk/polychat-component-ui";
import { getDiscoverEpisodeAudioUrl } from "@ngriffin_uk/polychat-library-client";
import {
  useDiscoverEpisode,
  useQueueDiscoverSeasonListen,
  useRecordDiscoverEpisodeProgress,
  useRetryDiscoverEpisodeChapter,
} from "@ngriffin_uk/polychat-library-react";
import type { DiscoverEpisode, DiscoverEpisodeChapter } from "@ngriffin_uk/polychat-schemas";
import { useMediaLoudness } from "@ngriffin_uk/polychat-utility-react";
import { Headphones, Podcast, RotateCcw, Tv } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { chapterStatus, describeChapterBeats } from "./episode-status.js";
import { EpisodeVisual } from "./EpisodeVisual.js";
import { useEpisodePlayback } from "./useEpisodePlayback.js";

const CHAPTER_PROGRESS: Record<string, string> = {
  pending: "is next in line",
  scripting: "is being written",
  rendering: "is being recorded",
};

function ChapterNotice({
  chapter,
  index,
  isRetrying,
  onRetry,
}: {
  chapter: DiscoverEpisodeChapter;
  index: number;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  if (chapter.status === "ready") {
    return null;
  }

  return chapter.status === "failed" ? (
    <MediaNotice
      status={chapterStatus(chapter)}
      message={`Chapter ${index + 1} didn't take.`}
      action={
        <MediaNoticeAction
          icon={<RotateCcw size={15} aria-hidden />}
          label="Try again"
          disabled={isRetrying}
          onClick={onRetry}
        />
      }
    />
  ) : (
    <MediaNotice
      status={chapterStatus(chapter)}
      message={`Chapter ${index + 1} ${CHAPTER_PROGRESS[chapter.status]}. It starts here when it's ready.`}
    />
  );
}

export function episodeHeading(episode: DiscoverEpisode | undefined) {
  return {
    eyebrow: episode
      ? `${episode.topic} · Part ${episode.part} of ${episode.parts}`
      : "Today's episode",
    title: episode?.title ?? "Today's episode",
    recap: episode?.recap ? `Previously: ${episode.recap}` : undefined,
  };
}

export function EpisodePlayer({
  episodeId,
  placeholder,
  onPlayingChange,
  className,
}: {
  episodeId: string | undefined;
  placeholder?: ReactNode;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}) {
  const episode = useDiscoverEpisode(episodeId).data;
  const retry = useRetryDiscoverEpisodeChapter(episodeId ?? "");
  const seasonListen = useQueueDiscoverSeasonListen();
  const progress = useRecordDiscoverEpisodeProgress(episodeId ?? "");
  const playback = useEpisodePlayback(episode, (update) => progress.mutate(update));
  const [listenOnly, setListenOnly] = useState(false);
  const { track, chapter, chapterIndex } = playback;
  const attachAudio = useMediaLoudness(track.attach);

  useEffect(() => onPlayingChange?.(track.playing), [onPlayingChange, track.playing]);

  const showPictures = !listenOnly || !episodeId;

  return (
    <MediaStage
      className={className}
      visual={
        showPictures ? (
          <>
            <EpisodeVisual
              episode={episode}
              chapter={chapter}
              chapterIndex={chapterIndex}
              seconds={track.currentTime}
              playing={track.playing}
            />
            {!episodeId ? placeholder : null}
            {episodeId && chapter ? (
              <ChapterNotice
                chapter={chapter}
                index={chapterIndex}
                isRetrying={retry.isPending}
                onRetry={() => retry.mutate(chapterIndex)}
              />
            ) : null}
          </>
        ) : null
      }
      transport={
        <>
          {episode && playback.ready ? (
            <audio
              key={chapterIndex}
              ref={attachAudio}
              preload="auto"
              autoPlay={playback.wantsPlay}
              crossOrigin="use-credentials"
              src={getDiscoverEpisodeAudioUrl(episode.id, chapterIndex)}
              onLoadedMetadata={(event) => playback.applyPendingSeek(event.currentTarget)}
            >
              <track kind="captions" />
            </audio>
          ) : null}
          <MediaTransport
            playing={track.playing}
            busy={track.buffering}
            disabled={!playback.ready}
            onToggle={playback.toggle}
            caption={
              episode && chapter
                ? `Chapter ${chapterIndex + 1} of ${episode.chapters.length} · ${chapter.title}`
                : undefined
            }
            actions={
              episode ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={listenOnly}
                  onClick={() => setListenOnly((value) => !value)}
                >
                  {listenOnly ? <Tv size={14} aria-hidden /> : <Headphones size={14} aria-hidden />}
                  {listenOnly ? "Pictures" : "Listen only"}
                </Button>
              ) : null
            }
            {...mediaPosition(track)}
          />
        </>
      }
    >
      {episode ? (
        <>
          <MediaTrackList
            label="Chapters"
            items={episode.chapters.map((entry, index) => ({
              key: `${index}:${entry.title}`,
              title: entry.title,
              detail: describeChapterBeats(entry.beats),
              status: chapterStatus(entry),
              active: index === chapterIndex,
              onPlay: entry.status === "ready" ? () => playback.playChapter(index) : undefined,
              onRetry: entry.status === "failed" ? () => retry.mutate(index) : undefined,
            }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={seasonListen.isPending || seasonListen.isSuccess}
              onClick={() => seasonListen.mutate(episode.seasonId)}
            >
              <Podcast size={14} aria-hidden />
              {seasonListen.isSuccess ? "Saving to The Perch" : "Save the season as one listen"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Every part so far, as one episode in your podcast feed.
            </p>
          </div>
        </>
      ) : null}
    </MediaStage>
  );
}
