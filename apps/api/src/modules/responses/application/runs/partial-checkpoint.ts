import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatEventSink } from "~/modules/chat/application/streaming/emitter";

const logger = getLogger({ prefix: "services/chat-runs/partial-checkpoint" });

export const PARTIAL_CHECKPOINT_INTERVAL_MS = 2_000;
export const PARTIAL_CHECKPOINT_MAX_CHARS = 100_000;

export interface PartialCheckpointSink extends ChatEventSink {
  flush(): Promise<void>;
}

export function createPartialCheckpointSink(
  sink: ChatEventSink,
  checkpoint: (content: string) => Promise<unknown>,
  options: { intervalMs?: number; now?: () => number } = {},
): PartialCheckpointSink {
  const intervalMs = options.intervalMs ?? PARTIAL_CHECKPOINT_INTERVAL_MS;
  const now = options.now ?? Date.now;
  let content = "";
  let dirty = false;
  let lastWrittenAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> = Promise.resolve();

  const write = () => {
    if (!dirty) {
      return pending;
    }

    dirty = false;
    lastWrittenAt = now();
    const snapshot = content.slice(0, PARTIAL_CHECKPOINT_MAX_CHARS);

    pending = pending
      .then(() => checkpoint(snapshot))
      .then(
        () => undefined,
        (error: unknown) => {
          logger.warn("Could not checkpoint partial run content", {
            error: getErrorMessage(error),
          });
        },
      );

    return pending;
  };

  return {
    async writeEvent(type, payload) {
      if (type === "turn_activity" && payload?.kind === "model_step_started") {
        if (content) {
          content = "";
          dirty = true;
          void write();
        }
      } else if (type === "content_block_delta" && typeof payload?.content === "string") {
        content += payload.content;
        dirty = true;

        if (now() - lastWrittenAt >= intervalMs) {
          void write();
        }
      }

      await sink.writeEvent(type, payload);
    },
    flush: write,
  };
}
