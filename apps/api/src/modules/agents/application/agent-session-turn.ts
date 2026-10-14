import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { AgentHarnessEvent, AgentHarnessEventRecord } from "@ngriffin_uk/polychat-schemas";
import { readServerSentEvents, readStringField } from "@ngriffin_uk/polychat-utility-core";
import { readRecordObjectField } from "@ngriffin_uk/polychat-utility-server/record-fields";

const logger = getLogger({ prefix: "agents/agent-sessions" });

export interface AgentSessionTranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

export interface AgentSessionTransport {
  harnessName: string;
  start: () => Promise<ReadableStream<Uint8Array>>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function agentSessionInput(transcript: readonly AgentSessionTranscriptEntry[]) {
  return transcript.map((entry) => ({
    role: entry.role,
    content: [{ type: entry.role === "user" ? "input_text" : "output_text", text: entry.text }],
  }));
}

function eventFromSession(
  event: Record<string, unknown>,
  operationId: string,
  harnessName: string,
): AgentHarnessEvent | null {
  const type = readStringField(event, "type");
  const turn = readRecordObjectField(event, "turn");
  const isRootTurn = turn.subagent_id === null || turn.subagent_id === undefined;

  if (type === "agent.session.turn.output_text.delta") {
    const delta = readStringField(event, "delta");

    return delta
      ? {
          type: "text-delta",
          partId: readStringField(event, "item_id") ?? operationId,
          delta,
        }
      : null;
  }

  if (type === "agent.session.turn.completed" && isRootTurn) {
    return { type: "operation-settled", operationId, status: "done" };
  }

  if (
    type === "error" ||
    type === "agent.session.failed" ||
    type === "agent.session.environment.failed" ||
    ((type === "agent.session.turn.failed" || type === "agent.session.turn.cancelled") &&
      isRootTurn)
  ) {
    const error = readRecordObjectField(event, "error");
    const turnError = readRecordObjectField(turn, "error");

    return {
      type: "operation-settled",
      operationId,
      status: "unanswered",
      reason:
        readStringField(error, "message") ??
        readStringField(turnError, "message") ??
        `${harnessName} reported ${type}`,
    };
  }

  return null;
}

export async function* agentSessionTurnRecords(
  transport: AgentSessionTransport,
  operationId: string,
): AsyncGenerator<AgentHarnessEventRecord> {
  const body = await transport.start();
  const queue: AgentHarnessEvent[] = [];
  let sessionId: string | undefined;
  let finished = false;
  let wake: (() => void) | undefined;
  const reading = readServerSentEvents(body, {
    onEvent: (event) => {
      if (readStringField(event, "type") === "agent.session.created") {
        sessionId = readStringField(readRecordObjectField(event, "session"), "id");
      }

      const translated = eventFromSession(event, operationId, transport.harnessName);

      if (translated) {
        queue.push(translated);
        wake?.();
      }
    },
  }).finally(() => {
    finished = true;
    wake?.();
  });
  let seq = 0;

  try {
    for (;;) {
      const event = queue.shift();

      if (event) {
        seq += 1;
        yield { seq, event };

        if (event.type === "operation-settled") {
          return;
        }

        continue;
      }

      if (finished) {
        seq += 1;
        yield {
          seq,
          event: {
            type: "operation-settled",
            operationId,
            status: "unanswered",
            reason: `The ${transport.harnessName} stream ended early`,
          },
        };

        return;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = undefined;
    }
  } finally {
    await reading.catch(() => undefined);

    if (sessionId) {
      await transport.deleteSession(sessionId).catch((error: unknown) => {
        logger.warn(`Failed to delete ${transport.harnessName} session`, {
          error,
          session_id: sessionId,
        });
      });
    }
  }
}
