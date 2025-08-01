import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface TabAudioCapture {
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  isCapturing: boolean;
}

export function useTabAudioCapture(): TabAudioCapture {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error("Tab audio capture is not supported in this browser");
        return null;
      }

      const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });

      media.getVideoTracks().forEach((t) => t.stop());

      setStream(media);
      return media;
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.warning("Tab capture permission denied");
      } else {
        console.error("Failed to start tab audio capture", err);
        toast.error("Failed to start tab audio capture");
      }
      return null;
    }
  }, []);

  return { start, stop, isCapturing: !!stream };
}
