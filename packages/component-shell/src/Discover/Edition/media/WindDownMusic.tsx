import { useEffect, useRef } from "react";

const MUSIC_VOLUME = 0.28;

export function WindDownMusic({ src, playing }: { src: string; playing: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = MUSIC_VOLUME;

    if (playing) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [playing, src]);

  return (
    <audio ref={audioRef} src={src} loop preload="auto" crossOrigin="use-credentials">
      <track kind="captions" />
    </audio>
  );
}
