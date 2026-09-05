import { performance } from "node:perf_hooks";

import { createStreamedToolResultEvent } from "../apps/api/src/lib/chat/streaming/tool-result-preview.ts";
import {
  createStreamProgressCoalescer,
  type FlushScheduler,
} from "../apps/app/src/lib/chat/stream-progress-coalescer.ts";

const deltaCount = 10_000;
const transcriptMessageCount = 2_000;
const initialMessageWindow = 100;
const toolCharacters = 8 * 1024 * 1024;
const transcriptContent = "m".repeat(4096);

let naiveRenders = 0;
const naiveStartedAt = performance.now();

for (let index = 0; index < deltaCount; index += 1) {
  naiveRenders += 1;
}

const naiveDurationMs = performance.now() - naiveStartedAt;
let scheduled: (() => void) | null = null;
const scheduler: FlushScheduler = (callback) => {
  scheduled = callback;

  return { cancel: () => (scheduled = null) };
};

let coalescedRenders = 0;
const coalesced = createStreamProgressCoalescer(() => {
  coalescedRenders += 1;
}, scheduler);
const coalescedStartedAt = performance.now();

for (let index = 1; index <= deltaCount; index += 1) {
  coalesced.handleUpdate(`token-${index}`);
}

const flush = scheduled;

if (flush) {
  flush();
}

const coalescedDurationMs = performance.now() - coalescedStartedAt;
const fullToolResult = {
  id: "tool-message-1",
  role: "tool" as const,
  name: "shell",
  status: "success",
  content: "x".repeat(toolCharacters),
  data: { responseType: "text" },
};
const streamedToolResult = createStreamedToolResultEvent(fullToolResult);
const transcript = Array.from({ length: transcriptMessageCount }, (_, index) => ({
  id: `message-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  content: transcriptContent,
}));
const initialWindow = transcript.slice(-initialMessageWindow);
const streamedToolBytes = Buffer.byteLength(JSON.stringify(streamedToolResult));

if (
  coalescedRenders !== 1 ||
  streamedToolBytes >= 64 * 1024 ||
  initialWindow.length !== initialMessageWindow
) {
  throw new Error("The representative workload exceeded its responsiveness bounds");
}

process.stdout.write(
  `${JSON.stringify(
    {
      workload: {
        deltaCount,
        toolCharacters,
        transcriptMessageCount,
        initialMessageWindow,
      },
      before: {
        iPhonePresentationUpdates: naiveRenders,
        webPresentationUpdates: 1,
        progressEventsBeforeMainThreadYield: "unbounded",
        renderLoopMs: Number(naiveDurationMs.toFixed(3)),
        streamedToolBytes: Buffer.byteLength(JSON.stringify(fullToolResult)),
        initialTranscriptBytes: Buffer.byteLength(JSON.stringify(transcript)),
      },
      after: {
        iPhonePresentationUpdates: coalescedRenders,
        webPresentationUpdates: coalescedRenders,
        progressEventsBeforeMainThreadYield: 64,
        renderLoopMs: Number(coalescedDurationMs.toFixed(3)),
        streamedToolBytes,
        initialTranscriptBytes: Buffer.byteLength(JSON.stringify(initialWindow)),
      },
    },
    null,
    2,
  )}\n`,
);
