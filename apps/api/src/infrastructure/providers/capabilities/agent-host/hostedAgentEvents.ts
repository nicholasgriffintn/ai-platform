import { isTerminalAgentHostRunEvent } from "@ngriffin_uk/polychat-schemas";
import {
  abortableDelay,
  isRecord,
  parseServerSentEventBuffer,
} from "@ngriffin_uk/polychat-utility-core";

export interface AgentRunProgress {
  toolsUsed: string[];
  toolErrors: number;
  subagentCompletions: number;
}

export function createAgentRunProgress(): AgentRunProgress {
  return { toolsUsed: [], toolErrors: 0, subagentCompletions: 0 };
}

export type AgentRunEventOutcome =
  | { kind: "terminal" }
  | { kind: "approval-requested" }
  | { kind: "stream-ended" }
  | { kind: "expired" };

function recordToolEvent(progress: AgentRunProgress, data: unknown): void {
  if (!isRecord(data)) {
    return;
  }

  const tool = typeof data.tool === "string" && data.tool ? data.tool : "unknown";

  if (!progress.toolsUsed.includes(tool)) {
    progress.toolsUsed.push(tool);
  }

  if (data.error === true) {
    progress.toolErrors += 1;
  }
}

export async function followAgentRunEvents(params: {
  response: Response;
  progress: AgentRunProgress;
  checkIn: () => Promise<void>;
  isExpired: () => boolean;
  initialDelayMs: number;
  maxDelayMs: number;
}): Promise<AgentRunEventOutcome> {
  const { response, progress, checkIn, isExpired } = params;
  const body = response.body;

  if (!body) {
    return { kind: "stream-ended" };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let delayMs = params.initialDelayMs;
  let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  let outcome: AgentRunEventOutcome | null = null;

  try {
    while (!outcome) {
      pendingRead ??= reader.read();
      const read = await Promise.race([pendingRead, abortableDelay(delayMs).then(() => null)]);

      if (read === null) {
        await checkIn();

        if (isExpired()) {
          outcome = { kind: "expired" };
          break;
        }

        delayMs = Math.min(params.maxDelayMs, Math.ceil(delayMs * 1.5));
        continue;
      }

      pendingRead = null;

      if (read.done) {
        outcome = { kind: "stream-ended" };
        break;
      }

      buffer = parseServerSentEventBuffer(buffer + decoder.decode(read.value, { stream: true }), {
        onEvent: (payload) => {
          const event = typeof payload.event === "string" ? payload.event : "";

          if (event === "tool.completed") {
            recordToolEvent(progress, payload);
          } else if (event === "tool.started") {
            const tool =
              typeof payload.tool === "string" && payload.tool ? payload.tool : "unknown";

            if (!progress.toolsUsed.includes(tool)) {
              progress.toolsUsed.push(tool);
            }
          } else if (event === "subagent.complete") {
            progress.subagentCompletions += 1;
          } else if (event === "approval.request") {
            outcome = { kind: "approval-requested" };
          } else if (isTerminalAgentHostRunEvent(event)) {
            outcome = { kind: "terminal" };
          }
        },
      });

      if (!outcome) {
        await checkIn();

        if (isExpired()) {
          outcome = { kind: "expired" };
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The stream already ended or was consumed elsewhere.
    }

    reader.releaseLock();
  }

  return outcome ?? { kind: "stream-ended" };
}
