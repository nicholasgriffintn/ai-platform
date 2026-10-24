import type { DiscoverEpisode } from "@ngriffin_uk/polychat-schemas";
import { useMediaTrack } from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useRef, useState } from "react";

import { readEpisodeResume, writeEpisodeResume } from "./episode-resume.js";
import { chapterSeconds } from "./episode-status.js";

const PROGRESS_STEPS = 4;

function watchedFraction(episode: DiscoverEpisode, chapterIndex: number, seconds: number): number {
  const lengths = episode.chapters.map(chapterSeconds);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const before = lengths.slice(0, chapterIndex).reduce((sum, length) => sum + length, 0);

  return total > 0 ? Math.min(1, (before + seconds) / total) : 0;
}

export function useEpisodePlayback(
  episode: DiscoverEpisode | undefined,
  onProgress?: (fraction: number) => void,
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

    const resume = readEpisodeResume(episode.id);

    if (resume && episode.chapters[resume.chapter]) {
      setChapterIndex(resume.chapter);
      pendingSeek.current = resume.seconds;
    }
  }, [episode]);

  useEffect(() => {
    if (episode && track.currentTime > 0) {
      writeEpisodeResume(episode.id, { chapter: chapterIndex, seconds: track.currentTime });
    }
  }, [chapterIndex, episode, track.currentTime]);

  const progressStep =
    episode && track.playing
      ? Math.floor(watchedFraction(episode, chapterIndex, track.currentTime) * PROGRESS_STEPS)
      : 0;
  const reportedStep = useRef(0);

  useEffect(() => {
    if (progressStep > reportedStep.current) {
      reportedStep.current = progressStep;
      onProgress?.(progressStep / PROGRESS_STEPS);
    }
  }, [onProgress, progressStep]);

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
