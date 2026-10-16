import { toolCallAddedEvent, toolCallDoneEvent } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/modules/responses/application/engine/streaming/emitter";
import { writeTurnActivity } from "~/modules/responses/application/engine/streaming/turn-activity";
import type { ToolCall } from "~/types";

export async function emitToolInputStart(
  sink: ChatEventSink,
  step: number,
  toolCallId: string,
  toolName: string,
) {
  await writeTurnActivity(sink, {
    kind: "tool_input_started",
    step,
    toolCallId,
    toolName,
  });
  await sink.write(toolCallAddedEvent(toolCallId, toolName));
}

export async function emitToolInputDelta(
  sink: ChatEventSink,
  toolCallId: string,
  parameters: string,
) {
  if (!parameters) {
    return;
  }

  await sink.write({
    type: "response.tool_call.arguments.delta",
    item_id: toolCallId,
    call_id: toolCallId,
    delta: parameters,
  });
}

export async function emitToolInputStop(
  sink: ChatEventSink,
  step: number,
  toolCallId: string,
  toolName: string,
  toolArguments?: string | Record<string, unknown>,
) {
  await sink.write(toolCallDoneEvent(toolCallId, toolName, toolArguments));
  await writeTurnActivity(sink, {
    kind: "tool_input_finished",
    step,
    toolCallId,
    toolName,
  });
}

export async function emitCompleteToolInput(sink: ChatEventSink, step: number, toolCall: ToolCall) {
  const toolCallId = toolCall.id || "unknown";
  const toolName = toolCall.function?.name || "unknown";
  const toolArguments = toolCall.function?.arguments || "{}";

  await emitToolInputStart(sink, step, toolCallId, toolName);
  await emitToolInputDelta(sink, toolCallId, toolArguments);
  await emitToolInputStop(sink, step, toolCallId, toolName, toolArguments);
}
