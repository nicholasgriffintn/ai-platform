import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaTrack {
  attach: (element: HTMLMediaElement | null) => void;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
}

const SYNC_EVENTS = [
  "play",
  "pause",
  "timeupdate",
  "loadedmetadata",
  "durationchange",
  "emptied",
] as const;

export function useMediaTrack(onEnded?: () => void): MediaTrack {
  const [element, setElement] = useState<HTMLMediaElement | null>(null);
  const elementRef = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const endedRef = useRef(onEnded);

  useEffect(() => {
    endedRef.current = onEnded;
  });

  useEffect(() => {
    if (!element) {
      return undefined;
    }

    const sync = () => {
      setPlaying(!element.paused);
      setCurrentTime(element.currentTime);
      setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    };

    const waiting = () => setBuffering(true);
    const flowing = () => setBuffering(false);
    const ended = () => {
      sync();
      endedRef.current?.();
    };

    sync();

    for (const event of SYNC_EVENTS) {
      element.addEventListener(event, sync);
    }

    element.addEventListener("waiting", waiting);
    element.addEventListener("playing", flowing);
    element.addEventListener("canplay", flowing);
    element.addEventListener("ended", ended);

    return () => {
      for (const event of SYNC_EVENTS) {
        element.removeEventListener(event, sync);
      }

      element.removeEventListener("waiting", waiting);
      element.removeEventListener("playing", flowing);
      element.removeEventListener("canplay", flowing);
      element.removeEventListener("ended", ended);
    };
  }, [element]);

  const attach = useCallback((next: HTMLMediaElement | null) => {
    elementRef.current = next;
    setElement(next);
  }, []);
  const play = useCallback(() => {
    void elementRef.current?.play().catch(() => setPlaying(false));
  }, []);
  const pause = useCallback(() => elementRef.current?.pause(), []);
  const toggle = useCallback(() => {
    if (elementRef.current?.paused) {
      play();
    } else {
      pause();
    }
  }, [pause, play]);
  const seek = useCallback((seconds: number) => {
    if (elementRef.current) {
      elementRef.current.currentTime = seconds;
    }
  }, []);

  return {
    attach,
    playing,
    buffering,
    currentTime,
    duration,
    toggle,
    play,
    pause,
    seek,
  };
}
