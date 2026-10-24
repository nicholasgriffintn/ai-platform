import { useState } from "react";

export interface ShotFrame {
  key: string;
  src: string;
  animation: string;
}

export function useShotFrames(current: ShotFrame | null) {
  const [frames, setFrames] = useState<ShotFrame[]>([]);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());

  if (current && frames.at(-1)?.key !== current.key) {
    const settled = frames.filter((frame) => loaded.has(frame.key)).slice(-1);

    setFrames([...settled, current]);
  }

  return {
    frames,
    isLoaded: (key: string) => loaded.has(key),
    markLoaded: (key: string) => setLoaded((previous) => new Set([...previous, key].slice(-8))),
  };
}
