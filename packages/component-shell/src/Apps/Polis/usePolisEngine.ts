import { polisService } from "@ngriffin_uk/polychat-library-client";
import type {
  PolisBucket,
  PolisBucketAnswer,
  PolisDecisionResponse,
  PolisRecording,
} from "@ngriffin_uk/polychat-schemas";
import { POLIS_MAX_BUCKETS_PER_REQUEST } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  PolisCommand,
  PolisEvent,
  PolisModelSettings,
  PolisRecordingSummary,
  PolisStatus,
} from "./engine/protocol.js";
import { summarisePoll, type PollResult } from "./poll.js";
import { downloadRecording, sharedTownUrl } from "./recording-file.js";

const DEFAULT_MODEL_SETTINGS: PolisModelSettings = { callsPerYear: 1000, holdForAnswers: false };

function errorText(caught: unknown): string {
  return caught instanceof Error ? caught.message : "The decision model did not answer";
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export type PolisPoll =
  | { status: "idle" }
  | { status: "asking"; proposal: string }
  | { status: "done"; proposal: string; result: PollResult }
  | { status: "failed"; proposal: string; message: string };

export type PolisShareState =
  | { status: "idle" }
  | { status: "sharing" }
  | { status: "shared"; token: string; url: string; day: number }
  | { status: "failed"; message: string };

export interface PolisEngineOptions {
  projectId?: string;
  recording?: PolisRecording;
}

export function usePolisEngine({ projectId, recording }: PolisEngineOptions = {}) {
  const workerRef = useRef<Worker | null>(null);
  const pollProposal = useRef("");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [recordings, setRecordings] = useState<PolisRecordingSummary[]>([]);
  const [restoring, setRestoring] = useState<{ name: string; progress: number } | null>(null);
  const [status, setStatus] = useState<PolisStatus | null>(null);
  const [poll, setPoll] = useState<PolisPoll>({ status: "idle" });
  const [modelSettings, setModelSettings] = useState(DEFAULT_MODEL_SETTINGS);
  const [share, setShare] = useState<PolisShareState>({ status: "idle" });

  const shareRecording = useCallback(
    async (town: PolisRecording) => {
      try {
        const { token } = await polisService.share(town, projectId);

        setShare({ status: "shared", token, url: sharedTownUrl(token), day: town.day });
      } catch (caught) {
        setShare({ status: "failed", message: errorText(caught) });
      }
    },
    [projectId],
  );

  const send = useCallback((command: PolisCommand, transfer: Transferable[] = []) => {
    workerRef.current?.postMessage(command, transfer);
  }, []);

  const answerDecisions = useCallback(
    async (event: Extract<PolisEvent, { type: "decide" }>) => {
      const { requestId, buckets, laws, model } = event;
      let response: PolisDecisionResponse | null = null;
      let error: string | undefined;

      try {
        response = await polisService.decide({ buckets, laws, model }, projectId);
        error = response.error;
      } catch (caught) {
        error = errorText(caught);
      }

      const answers = response?.answers ?? [];
      const answered = new Set(answers.map((answer) => answer.key));

      send({
        type: "answers",
        requestId,
        answers,
        failedKeys: buckets.map((bucket) => bucket.key).filter((key) => !answered.has(key)),
        tokens: response?.inputTokens ?? 0,
        model: response?.model ?? null,
        error,
      });
    },
    [projectId, send],
  );

  const answerPoll = useCallback(
    async (event: Extract<PolisEvent, { type: "pollBuckets" }>) => {
      const proposal = pollProposal.current;
      const { buckets, laws, model } = event;
      const asked: PolisBucket[] = buckets.map(({ bucket }) => bucket);

      try {
        const batches = await Promise.all(
          chunk(asked, POLIS_MAX_BUCKETS_PER_REQUEST).map((batch) =>
            polisService.decide({ buckets: batch, laws, model, proposal }, projectId),
          ),
        );
        const answers: PolisBucketAnswer[] = batches.flatMap((batch) => batch.answers);

        if (answers.length === 0) {
          throw new Error(batches[0]?.error ?? "The decision model did not answer");
        }

        setPoll({ status: "done", proposal, result: summarisePoll(buckets, answers) });
      } catch (caught) {
        setPoll({ status: "failed", proposal, message: errorText(caught) });
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!container) {
      return undefined;
    }

    const worker = new Worker(new URL("./engine/polis.worker.js", import.meta.url), {
      type: "module",
    });
    const canvas = document.createElement("canvas");
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const measure = () => ({
      width: container.clientWidth,
      height: container.clientHeight,
      pixelRatio,
    });

    canvas.className = "block size-full touch-none cursor-grab active:cursor-grabbing";
    canvas.setAttribute("aria-label", "Map of the town");
    container.prepend(canvas);
    workerRef.current = worker;

    worker.onmessage = (message: MessageEvent<PolisEvent>) => {
      const event = message.data;

      if (event.type === "ready") {
        setRecordings(event.recordings);
        setReady(true);
      } else if (event.type === "status") {
        setRestoring(null);
        setStatus(event.status);
      } else if (event.type === "recordings") {
        setRecordings(event.recordings);
      } else if (event.type === "restoring") {
        setRestoring({ name: event.name, progress: event.day / Math.max(event.endDay, 1) });
      } else if (event.type === "recording" && event.purpose === "share") {
        void shareRecording(event.recording);
      } else if (event.type === "recording") {
        downloadRecording(event.recording);
      } else if (event.type === "decide") {
        void answerDecisions(event);
      } else {
        void answerPoll(event);
      }
    };

    const offscreen = canvas.transferControlToOffscreen();

    worker.postMessage({ type: "canvas", canvas: offscreen, ...measure() } satisfies PolisCommand, [
      offscreen,
    ]);

    const observer = new ResizeObserver(() => {
      worker.postMessage({ type: "resize", ...measure() } satisfies PolisCommand);
    });

    observer.observe(container);

    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;

      moved += Math.abs(dx) + Math.abs(dy);
      lastX = event.clientX;
      lastY = event.clientY;
      worker.postMessage({ type: "pan", dx, dy } satisfies PolisCommand);
    };

    const onUp = (event: PointerEvent) => {
      dragging = false;

      if (moved < 5) {
        const bounds = canvas.getBoundingClientRect();

        worker.postMessage({
          type: "click",
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        } satisfies PolisCommand);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const bounds = canvas.getBoundingClientRect();

      worker.postMessage({
        type: "zoom",
        factor: Math.exp(-event.deltaY * 0.0016),
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      } satisfies PolisCommand);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      worker.terminate();
      workerRef.current = null;
      canvas.remove();
      setReady(false);
      setStatus(null);
    };
  }, [answerDecisions, answerPoll, container, shareRecording]);

  useEffect(() => {
    if (ready) {
      send({ type: "model", settings: modelSettings });
    }
  }, [modelSettings, ready, send]);

  useEffect(() => {
    if (ready && recording) {
      send({ type: "import", recording, watch: true });
    }
  }, [ready, recording, send]);

  const shareTown = useCallback(() => {
    setShare({ status: "sharing" });
    send({ type: "export", purpose: "share" });
  }, [send]);

  const stopSharing = useCallback(async () => {
    if (share.status !== "shared") {
      return;
    }

    try {
      await polisService.stopSharing(share.token);
      setShare({ status: "idle" });
    } catch (caught) {
      setShare({ status: "failed", message: errorText(caught) });
    }
  }, [share]);

  const askTown = useCallback(
    (proposal: string) => {
      pollProposal.current = proposal;
      setPoll({ status: "asking", proposal });
      send({ type: "poll", requestId: Date.now() });
    },
    [send],
  );

  const clearPoll = useCallback(() => setPoll({ status: "idle" }), []);

  return {
    setContainer,
    ready,
    recordings,
    restoring,
    status,
    poll,
    modelSettings,
    setModelSettings,
    send,
    askTown,
    clearPoll,
    share,
    shareTown,
    stopSharing,
    viewOnly: Boolean(recording),
  };
}

export type PolisEngine = ReturnType<typeof usePolisEngine>;
