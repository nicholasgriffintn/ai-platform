import { useChatStore, verbatimService } from "@ngriffin_uk/polychat-library-client";
import { useRealtimeLiveSession, useRealtimeProviders } from "@ngriffin_uk/polychat-library-react";
import {
  encodePcm16Wav,
  requestRealtimeAudioStream,
  startPcm16MicrophoneStream,
  stopMediaStream,
  type RealtimeMediaController,
} from "@ngriffin_uk/polychat-library-realtime/audio";
import {
  getFirstReadyRealtimeTranscriptionProviderOption,
  getRealtimeLiveProviderOption,
  type RealtimeLiveProviderOption,
} from "@ngriffin_uk/polychat-library-realtime/live-providers";
import type { RealtimeTranscriptResult } from "@ngriffin_uk/polychat-library-realtime/messages";
import type { VerbatimSegment } from "@ngriffin_uk/polychat-schemas";
import { VERBATIM_CONTEXT_MAX_LENGTH } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyLiveTranscript,
  EMPTY_LIVE_DRAFT,
  liveDraftText,
  markLiveDraftSubmitted,
} from "./liveDraft.js";
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

const PREFERRED_TRANSCRIPTION_PROVIDER = "workers-ai";

function selectTranscriptionProvider(
  options: RealtimeLiveProviderOption[],
): RealtimeLiveProviderOption | undefined {
  const preferred = getRealtimeLiveProviderOption(PREFERRED_TRANSCRIPTION_PROVIDER, options);

  return preferred?.readiness === "ready"
    ? preferred
    : getFirstReadyRealtimeTranscriptionProviderOption(options);
}

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
  const draftRef = useRef(EMPTY_LIVE_DRAFT);
  const isPro = useChatStore((state) => state.isPro);
  const { data: realtimeProviders = [] } = useRealtimeProviders(isPro);

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

      const draft = liveDraftText(draftRef.current);

      nextIdRef.current += 1;
      draftRef.current = markLiveDraftSubmitted(draftRef.current);
      setLive("");
      setEntries((current) => [
        ...current,
        draft ? { id, state: "drafted", durationMs, draft } : { id, state: "pending", durationMs },
      ]);
      void verify(id, durationMs, wav);
    },
    [verify],
  );

  const handleTranscript = useCallback(
    (transcript: RealtimeTranscriptResult) => {
      if (transcript.source === "output") {
        return;
      }

      draftRef.current = applyLiveTranscript(draftRef.current, transcript);
      setLive(liveDraftText(draftRef.current));

      if (!transcript.isFinal) {
        return;
      }

      const segment = segmenterRef.current.flush();

      if (segment) {
        submit(segment);
      }
    },
    [submit],
  );
  const {
    start: startTranscription,
    status: transcriptionStatus,
    stop: stopTranscription,
  } = useRealtimeLiveSession({
    providers: realtimeProviders,
    sessionType: "transcription",
    onTranscript: handleTranscript,
  });

  useEffect(() => {
    segmenterRef.current.setCommitOnSilence(transcriptionStatus !== "active");
  }, [transcriptionStatus]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    stopTranscription();
    stopMediaStream(streamRef.current);
    streamRef.current = null;

    const remaining = segmenterRef.current.flush();

    if (remaining) {
      submit(remaining);
    }

    draftRef.current = EMPTY_LIVE_DRAFT;
    setLive("");

    setLevel(0);
    setStatus("idle");
  }, [stopTranscription, submit]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");

    try {
      const stream = await requestRealtimeAudioStream();

      streamRef.current = stream;
      segmenterRef.current = new SpeechSegmenter();
      segmenterRef.current.setCommitOnSilence(transcriptionStatus !== "active");
      controllerRef.current = await startPcm16MicrophoneStream({
        stream,
        sampleRate: SEGMENT_SAMPLE_RATE,
        onChunk: (chunk) => {
          const step = segmenterRef.current.push(chunk, Date.now());

          setLevel(step.level);

          if (step.segment) {
            submit(step.segment);
          }
        },
      });

      const provider = selectTranscriptionProvider(realtimeProviders);

      if (provider) {
        void startTranscription(provider.id, undefined, { inputStream: stream });
      }

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
  }, [realtimeProviders, startTranscription, submit, transcriptionStatus]);

  const clear = useCallback(() => {
    transcriptRef.current = "";
    draftRef.current = EMPTY_LIVE_DRAFT;
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
