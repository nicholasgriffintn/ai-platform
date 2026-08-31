import type { Message } from "~/types";

export type StreamProgressHandler = (
  content: Message["content"],
  reasoning?: string,
  toolResponses?: Message[],
  done?: boolean,
  assistantMessage?: Message,
) => void;

export interface ScheduledFlush {
  cancel: () => void;
}

export type FlushScheduler = (callback: () => void) => ScheduledFlush;

export interface StreamProgressCoalescer {
  handleUpdate: StreamProgressHandler;
  flush: () => void;
  stop: () => void;
}

interface PendingUpdate {
  content: Message["content"];
  reasoning?: string;
}

const FALLBACK_FRAME_MS = 16;

const supportsAnimationFrames = () =>
  typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function";

const scheduleOnFrame: FlushScheduler = (callback) => {
  if (supportsAnimationFrames()) {
    const frame = requestAnimationFrame(() => callback());

    return { cancel: () => cancelAnimationFrame(frame) };
  }

  const timer = setTimeout(callback, FALLBACK_FRAME_MS);

  return { cancel: () => clearTimeout(timer) };
};

const isSupersedableDelta = (
  content: Message["content"],
  toolResponses?: Message[],
  done?: boolean,
  assistantMessage?: Message,
) => typeof content === "string" && !done && !assistantMessage && !toolResponses?.length;

export function createStreamProgressCoalescer(
  onUpdate: StreamProgressHandler,
  scheduleFlush: FlushScheduler = scheduleOnFrame,
): StreamProgressCoalescer {
  let pending: PendingUpdate | null = null;
  let scheduled: ScheduledFlush | null = null;
  let stopped = false;

  const flush = () => {
    scheduled?.cancel();
    scheduled = null;

    const update = pending;

    pending = null;

    if (update) {
      onUpdate(update.content, update.reasoning);
    }
  };

  const handleUpdate: StreamProgressHandler = (
    content,
    reasoning,
    toolResponses,
    done,
    assistantMessage,
  ) => {
    if (stopped || !isSupersedableDelta(content, toolResponses, done, assistantMessage)) {
      flush();
      onUpdate(content, reasoning, toolResponses, done, assistantMessage);

      return;
    }

    pending = { content, reasoning };

    scheduled ??= scheduleFlush(() => {
      scheduled = null;
      flush();
    });
  };

  return {
    handleUpdate,
    flush,
    stop: () => {
      stopped = true;
      flush();
    },
  };
}
