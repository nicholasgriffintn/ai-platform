import { verbatimService } from "@ngriffin_uk/polychat-library-client";
import {
  encodePcm16Wav,
  requestRealtimeAudioStream,
  startPcm16MicrophoneStream,
  stopMediaStream,
  type RealtimeMediaController,
} from "@ngriffin_uk/polychat-library-realtime/audio";
import type { VerbatimSegment } from "@ngriffin_uk/polychat-schemas";
import { VERBATIM_CONTEXT_MAX_LENGTH } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

import { SEGMENT_SAMPLE_RATE, SpeechSegmenter } from "./segmenter.js";

export type LiveTranscriptStatus = "idle" | "starting" | "listening";

export type TranscriptEntry =
  | { id: number; state: "pending"; durationMs: number }
  | { id: number; state: "drafted"; durationMs: number; draft: string }
  | { id: number; state: "failed"; durationMs: number; error: string }
  | {
      id: number;
      state: "done";
      durationMs: number;
      result: VerbatimSegment;
      roundTripMs: number;
    };

function segmentDurationMs(chunks: readonly ArrayBuffer[]): number {
  const bytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  return (bytes / 2 / SEGMENT_SAMPLE_RATE) * 1000;
}

export function transcriptText(entries: readonly TranscriptEntry[]): string {
  return entries
    .flatMap((entry) =>
      entry.state === "done" && entry.result.status === "transcribed" && entry.result.text
        ? [entry.result.text]
        : [],
    )
    .join(" ");
}

const LIVE_DRAFT_INTERVAL_MS = 900;

export function useLiveTranscript(projectId?: string) {
  const [status, setStatus] = useState<LiveTranscriptStatus>("idle");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controllerRef = useRef<RealtimeMediaController | null>(null);
  const segmenterRef = useRef(new SpeechSegmenter());
  const transcriptRef = useRef("");
  const nextIdRef = useRef(1);
  const liveRef = useRef({ generation: 0, inFlight: false, lastAt: 0, text: "" });

  const updateEntry = useCallback((entry: TranscriptEntry) => {
    setEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)));
  }, []);

  const verify = useCallback(
    async (id: number, durationMs: number, wav: Blob) => {
      const started = performance.now();
      const context = transcriptRef.current.slice(-VERBATIM_CONTEXT_MAX_LENGTH);
      let failure: string | null = null;

      try {
        await verbatimService.streamSegment(
          wav,
          context,
          (event) => {
            if (event.type === "draft") {
              transcriptRef.current = `${transcriptRef.current} ${event.text}`.trim();
              updateEntry({ id, state: "drafted", durationMs, draft: event.text });
            } else if (event.type === "segment") {
              updateEntry({
                id,
                state: "done",
                durationMs,
                result: event.segment,
                roundTripMs: performance.now() - started,
              });
            } else {
              failure = event.error;
            }
          },
          projectId,
        );
      } catch (caught) {
        failure = caught instanceof Error ? caught.message : "This phrase could not be checked";
      }

      if (failure) {
        updateEntry({ id, state: "failed", durationMs, error: failure });
      }
    },
    [projectId, updateEntry],
  );

  const submit = useCallback(
    (chunks: ArrayBuffer[]) => {
      const id = nextIdRef.current;
      const durationMs = segmentDurationMs(chunks);
      const wav = new Blob([encodePcm16Wav(chunks, SEGMENT_SAMPLE_RATE)], { type: "audio/wav" });

      const draft = liveRef.current.text;

      nextIdRef.current += 1;
      liveRef.current = {
        ...liveRef.current,
        generation: liveRef.current.generation + 1,
        text: "",
      };
      setLive("");
      setEntries((current) => [
        ...current,
        draft ? { id, state: "drafted", durationMs, draft } : { id, state: "pending", durationMs },
      ]);
      void verify(id, durationMs, wav);
    },
    [verify],
  );

  const draftLive = useCallback((chunks: ArrayBuffer[]) => {
    const state = liveRef.current;
    const generation = state.generation;

    liveRef.current = { ...state, inFlight: true, lastAt: Date.now() };

    const wav = new Blob([encodePcm16Wav(chunks, SEGMENT_SAMPLE_RATE)], { type: "audio/wav" });

    void verbatimService
      .transcribeDraft(wav)
      .then((text) => {
        if (liveRef.current.generation === generation) {
          liveRef.current = { ...liveRef.current, text };
          setLive(text);
        }

        return text;
      })
      .catch(() => "")
      .finally(() => {
        liveRef.current = { ...liveRef.current, inFlight: false };
      });
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;

    const remaining = segmenterRef.current.flush();

    if (remaining) {
      submit(remaining);
    }

    liveRef.current = { ...liveRef.current, generation: liveRef.current.generation + 1, text: "" };
    setLive("");

    setLevel(0);
    setStatus("idle");
  }, [submit]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");

    try {
      const stream = await requestRealtimeAudioStream();

      streamRef.current = stream;
      segmenterRef.current = new SpeechSegmenter();
      controllerRef.current = await startPcm16MicrophoneStream({
        stream,
        sampleRate: SEGMENT_SAMPLE_RATE,
        onChunk: (chunk) => {
          const step = segmenterRef.current.push(chunk, Date.now());

          setLevel(step.level);

          if (step.segment) {
            submit(step.segment);

            return;
          }

          const { inFlight, lastAt } = liveRef.current;
          const inProgress = segmenterRef.current.peek();

          if (inProgress && !inFlight && Date.now() - lastAt >= LIVE_DRAFT_INTERVAL_MS) {
            draftLive(inProgress);
          }
        },
      });
      setStatus("listening");
    } catch (caught) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setStatus("idle");
      setError(
        caught instanceof Error && caught.name === "NotAllowedError"
          ? "Microphone access was refused. Allow it in your browser and try again."
          : "The microphone would not start.",
      );
    }
  }, [draftLive, submit]);

  const clear = useCallback(() => {
    transcriptRef.current = "";
    setLive("");
    setEntries([]);
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.stop();
      stopMediaStream(streamRef.current);
    },
    [],
  );

  return { status, entries, live, level, error, start, stop, clear };
}
