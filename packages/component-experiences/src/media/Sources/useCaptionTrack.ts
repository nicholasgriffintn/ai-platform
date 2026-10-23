import { useEffect, useRef } from "react";

export function useCaptionTrack(vtt: string | null) {
  const trackRef = useRef<HTMLTrackElement>(null);

  useEffect(() => {
    const track = trackRef.current;

    if (!track || !vtt) {
      return undefined;
    }

    const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));

    track.src = url;

    return () => {
      track.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [vtt]);

  return trackRef;
}
