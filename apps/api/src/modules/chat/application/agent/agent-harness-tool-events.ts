import type { AgentHarnessToolStreamEvent } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ChatEventSink } from "~/modules/chat/application/streaming/emitter";
import { createStreamedToolResultEvent } from "~/modules/chat/application/streaming/tool-result-preview";
import { writeTurnActivity } from "~/modules/chat/application/streaming/turn-activity";
import { emitToolInputStart, emitToolInputStop } from "~/modules/chat/application/tools/events";
import type { MessagePart } from "~/types";

function toolInput(value: unknown): string | unknown[] | Record<string, unknown> | undefined {
  return typeof value === "string" || Array.isArray(value) || isRecord(value) ? value : undefined;
}

export async function applyAgentHarnessToolEvent(
  event: AgentHarnessToolStreamEvent,
  target: { sink: ChatEventSink; step: number; parts: MessagePart[] },
): Promise<void> {
  const timestamp = Date.now();

  if (event.phase === "started") {
    await emitToolInputStart(target.sink, target.step, event.toolCallId, event.toolName);
    await emitToolInputStop(target.sink, target.step, event.toolCallId, event.toolName);
    await writeTurnActivity(target.sink, {
      kind: "tool_execution_started",
      step: target.step,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
    });
    target.parts.push({
      type: "tool_use",
      name: event.toolName,
      toolCallId: event.toolCallId,
      input: toolInput(event.input),
      timestamp,
    });

    return;
  }

  const failed = event.error !== undefined;
  const content = event.error ?? event.output ?? "";
  const status = failed ? "error" : "success";

  target.parts.push({
    type: "tool_result",
    name: event.toolName,
    toolCallId: event.toolCallId,
    status,
    content,
    data: { formattedName: event.toolName, responseType: "text", result: content },
    timestamp,
  });
  await target.sink.writeEvent(
    "tool_response",
    createStreamedToolResultEvent({
      role: "tool",
      id: event.toolCallId,
      tool_call_id: event.toolCallId,
      name: event.toolName,
      content,
      status,
    }),
  );
  await writeTurnActivity(target.sink, {
    kind: "tool_finished",
    step: target.step,
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    outcome: failed ? "failure" : "success",
  });
}
