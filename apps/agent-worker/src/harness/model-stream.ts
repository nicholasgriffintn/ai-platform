import type { AgentHarnessEvent } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function modelChunkToHarnessEvents(chunk: unknown, partId: string): AgentHarnessEvent[] {
  if (!isRecord(chunk)) {
    return [];
  }

  const events: AgentHarnessEvent[] = [];
  const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
  const delta = isRecord(choice) && isRecord(choice.delta) ? choice.delta : undefined;
  const reasoning = delta?.reasoning_content ?? delta?.reasoning;

  if (typeof reasoning === "string" && reasoning) {
    events.push({ type: "reasoning-delta", partId, delta: reasoning });
  }

  if (typeof delta?.content === "string" && delta.content) {
    events.push({ type: "text-delta", partId, delta: delta.content });
  }

  if (isRecord(chunk.usage)) {
    events.push({
      type: "usage",
      inputTokens: readCount(chunk.usage.prompt_tokens),
      outputTokens: readCount(chunk.usage.completion_tokens),
    });
  }

  return events;
}

export async function observeModelStream(
  body: ReadableStream<Uint8Array>,
  partId: string,
  emit: (event: AgentHarnessEvent) => void,
): Promise<void> {
  await readServerSentEvents(body, {
    onEvent: (chunk) => {
      for (const event of modelChunkToHarnessEvents(chunk, partId)) {
        emit(event);
      }
    },
  });
}
