import { stopMediaStream } from "@ngriffin_uk/polychat-library-realtime/audio";
import { useCallback, useEffect, useRef, useState } from "react";

export type ClipRecorderPhase = "off" | "starting" | "ready" | "countdown" | "recording";

const CLIP_MIME_TYPES = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
};

function supportedClipMimeType(): string | undefined {
  return CLIP_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export const CLIP_SECONDS = 6;

export function useClipRecorder({ countdownSeconds = 3, clipSeconds = CLIP_SECONDS } = {}) {
  const [phase, setPhase] = useState<ClipRecorderPhase>("off");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(
    (seconds: number) =>
      new Promise<void>((resolve) => {
        clearTimer();
        setSecondsLeft(seconds);
        let remaining = seconds;

        timerRef.current = window.setInterval(() => {
          remaining -= 1;
          setSecondsLeft(remaining);

          if (remaining <= 0) {
            clearTimer();
            resolve();
          }
        }, 1000);
      }),
    [clearTimer],
  );

  const openCamera = useCallback(async () => {
    setError(null);
    setPhase("starting");

    try {
      const media = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

      streamRef.current = media;
      setStream(media);
      setPhase("ready");
    } catch (caught) {
      setPhase("off");
      setError(
        caught instanceof Error && caught.name === "NotAllowedError"
          ? "Camera access was refused. Allow it in your browser and try again."
          : "The camera would not start.",
      );
    }
  }, []);

  const closeCamera = useCallback(() => {
    clearTimer();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setPhase("off");
  }, [clearTimer]);

  const record = useCallback(async (): Promise<Blob | null> => {
    const media = streamRef.current;
    const mimeType = supportedClipMimeType();

    if (!media || !mimeType) {
      setError("This browser cannot record video clips.");

      return null;
    }

    setPhase("countdown");
    await tick(countdownSeconds);

    const recorder = new MediaRecorder(media, { mimeType, videoBitsPerSecond: 900_000 });
    const chunks: Blob[] = [];
    const finished = new Promise<Blob>((resolve) => {
      recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));
      recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })));
    });

    setPhase("recording");
    recorder.start();
    await tick(clipSeconds);
    recorder.stop();

    const clip = await finished;

    setPhase("ready");

    return clip;
  }, [clipSeconds, countdownSeconds, tick]);

  useEffect(
    () => () => {
      clearTimer();
      stopMediaStream(streamRef.current);
    },
    [clearTimer],
  );

  return { phase, stream, secondsLeft, error, openCamera, closeCamera, record };
}
