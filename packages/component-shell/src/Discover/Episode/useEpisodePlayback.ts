import type { DiscoverEpisode, DiscoverEpisodeProgress } from "@ngriffin_uk/polychat-schemas";
import { useMediaTrack } from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useRef, useState } from "react";

import { progressMark, watchedFraction } from "./episode-progress.js";

export function useEpisodePlayback(
  episode: DiscoverEpisode | undefined,
  onProgress?: (progress: DiscoverEpisodeProgress) => void,
) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);
  const pendingSeek = useRef<number | null>(null);
  const resumedFor = useRef<string | null>(null);
  const chapters = episode?.chapters ?? [];
  const chapter = chapters[chapterIndex] ?? chapters[0];
  const track = useMediaTrack(() => {
    if (chapterIndex + 1 < chapters.length) {
      pendingSeek.current = 0;
      setChapterIndex(chapterIndex + 1);
    } else {
      setWantsPlay(false);
    }
  });

  useEffect(() => {
    if (!episode || resumedFor.current === episode.id) {
      return;
    }

    resumedFor.current = episode.id;

    const resume = episode.progress.resume;

    if (resume && episode.chapters[resume.chapter]) {
      setChapterIndex(resume.chapter);
      pendingSeek.current = resume.seconds;
    }
  }, [episode]);

  const mark =
    episode && track.currentTime > 0
      ? progressMark(chapterIndex, track.currentTime, track.playing)
      : null;
  const reportedMark = useRef<string | null>(null);

  useEffect(() => {
    if (!episode || mark === null || mark === reportedMark.current) {
      return;
    }

    reportedMark.current = mark;
    onProgress?.({
      fraction: watchedFraction(episode, chapterIndex, track.currentTime),
      resume: { chapter: chapterIndex, seconds: track.currentTime },
    });
  }, [chapterIndex, episode, mark, onProgress, track.currentTime]);

  return {
    track,
    chapter,
    chapterIndex,
    wantsPlay,
    ready: chapter?.status === "ready",
    applyPendingSeek: (audio: HTMLAudioElement) => {
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
    },
    toggle: () => {
      setWantsPlay(!track.playing);
      track.toggle();
    },
    playChapter: (index: number) => {
      pendingSeek.current = 0;
      setChapterIndex(index);
      setWantsPlay(true);
    },
  };
}
