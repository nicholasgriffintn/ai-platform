import {
  AGENT_HARNESS_APPROVAL_TOOL,
  AGENT_HARNESS_TOOL_STREAM_TYPE,
  agentHarnessEventRecordSchema,
  type AgentHarnessEventRecord,
  type AgentHarnessToolStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, readServerSentEvents, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

const APPROVAL_TOOL_CALL_PATTERN = /^hx-(\d+)-([A-Za-z0-9_-]+)$/u;

export interface HarnessApprovalReference {
  seq: number;
  approvalId: string;
}

export function approvalToolCallId(reference: HarnessApprovalReference): string {
  return `hx-${reference.seq}-${reference.approvalId}`;
}

export function parseApprovalToolCallId(value: unknown): HarnessApprovalReference | null {
  const match = typeof value === "string" ? APPROVAL_TOOL_CALL_PATTERN.exec(value) : null;

  return match ? { seq: Number.parseInt(match[1], 10), approvalId: match[2] } : null;
}

export function agentHarnessSessionKey(userId: number, conversationId: string): string {
  return `${userId}-${conversationId.replace(/[^A-Za-z0-9_-]/gu, "-")}`.slice(0, 160);
}

export interface ProviderChunks {
  chunks: unknown[];
  done: boolean;
}

function delta(fields: Record<string, unknown>, finishReason: string | null = null) {
  return { choices: [{ index: 0, delta: fields, finish_reason: finishReason }] };
}

export function harnessRecordToProviderChunks(
  record: AgentHarnessEventRecord,
  context: { operationId?: string; harnessName: string },
): ProviderChunks {
  const { event } = record;

  switch (event.type) {
    case "text-delta":
      return { chunks: [delta({ content: event.delta })], done: false };
    case "reasoning-delta":
      return { chunks: [delta({ reasoning_content: event.delta })], done: false };
    case "tool-started":
      return {
        chunks: [
          {
            type: AGENT_HARNESS_TOOL_STREAM_TYPE,
            phase: "started",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            ...(event.input !== undefined ? { input: event.input } : {}),
          } satisfies AgentHarnessToolStreamEvent,
        ],
        done: false,
      };
    case "tool-finished":
      return {
        chunks: [
          {
            type: AGENT_HARNESS_TOOL_STREAM_TYPE,
            phase: "finished",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            ...(event.output !== undefined ? { output: event.output } : {}),
            ...(event.error !== undefined ? { error: event.error } : {}),
          } satisfies AgentHarnessToolStreamEvent,
        ],
        done: false,
      };
    case "approval-requested":
      return {
        chunks: [
          delta({
            tool_calls: [
              {
                index: 0,
                id: approvalToolCallId({ seq: record.seq, approvalId: event.approvalId }),
                type: "function",
                function: {
                  name: AGENT_HARNESS_APPROVAL_TOOL,
                  arguments: JSON.stringify({
                    message: `${context.harnessName} needs your approval: ${event.description}`,
                    options: ["Approve", "Reject"],
                  }),
                },
              },
            ],
          }),
          delta({}, "tool_calls"),
        ],
        done: true,
      };
    case "operation-settled":
      if (context.operationId && event.operationId !== context.operationId) {
        return { chunks: [], done: false };
      }

      return event.status === "done"
        ? { chunks: [delta({}, "stop")], done: true }
        : {
            chunks: [
              {
                error: {
                  message: event.reason
                    ? `${context.harnessName} stopped: ${event.reason}`
                    : `${context.harnessName} did not finish this turn`,
                },
              },
            ],
            done: true,
          };
    default:
      return { chunks: [], done: false };
  }
}

export async function* readHarnessRecords(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<AgentHarnessEventRecord> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };

  let buffer = "";

  signal.addEventListener("abort", cancel, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const record = agentHarnessEventRecordSchema.safeParse(safeParseJson(line));

        if (record.success) {
          yield record.data;
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export interface CollectedHarnessResponse {
  response: string;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  error?: string;
}

export async function collectHarnessProviderStream(
  stream: ReadableStream<Uint8Array>,
): Promise<CollectedHarnessResponse> {
  const collected: CollectedHarnessResponse = { response: "", toolCalls: [] };

  await readServerSentEvents(stream, {
    onEvent: (chunk) => {
      const error = isRecord(chunk.error) ? chunk.error.message : undefined;

      if (typeof error === "string") {
        collected.error = error;
      }

      const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
      const choiceDelta = isRecord(choice) && isRecord(choice.delta) ? choice.delta : undefined;

      if (typeof choiceDelta?.content === "string") {
        collected.response += choiceDelta.content;
      }

      for (const call of Array.isArray(choiceDelta?.tool_calls) ? choiceDelta.tool_calls : []) {
        if (
          isRecord(call) &&
          typeof call.id === "string" &&
          isRecord(call.function) &&
          typeof call.function.name === "string" &&
          typeof call.function.arguments === "string"
        ) {
          collected.toolCalls.push({
            id: call.id,
            type: "function",
            function: { name: call.function.name, arguments: call.function.arguments },
          });
        }
      }
    },
  });

  return collected;
}
