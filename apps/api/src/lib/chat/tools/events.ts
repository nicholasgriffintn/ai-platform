import type { ChatEventSink } from "~/lib/chat/streaming/emitter";
import { writeTurnActivity } from "~/lib/chat/streaming/turn-activity";
import type { ToolCall, ToolEventPayload } from "~/types";
import { ToolStage } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function getToolEventPayload(
  toolCall: ToolCall,
  stage: ToolStage,
  parameters?: string,
): ToolEventPayload {
  const payload: ToolEventPayload = {
    tool_id: toolCall.id,
  };

  switch (stage) {
    case ToolStage.START:
      payload.tool_name = toolCall.function?.name || "";
      break;
    case ToolStage.DELTA:
      payload.parameters = parameters || "{}";
      break;
    case ToolStage.STOP:
      break;
    default: {
      throw new AssistantError("Unsupported tool stage", ErrorType.INTERNAL_ERROR);
    }
  }

  return payload;
}

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
  await sink.writeEvent("tool_use_start", {
    tool_id: toolCallId,
    tool_name: toolName,
  });
}

export async function emitToolInputDelta(
  sink: ChatEventSink,
  toolCallId: string,
  parameters: string,
) {
  if (!parameters) {
    return;
  }

  await sink.writeEvent("tool_use_delta", {
    tool_id: toolCallId,
    parameters,
  });
}

export async function emitToolInputStop(
  sink: ChatEventSink,
  step: number,
  toolCallId: string,
  toolName: string,
) {
  await sink.writeEvent("tool_use_stop", { tool_id: toolCallId });
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

  await emitToolInputStart(sink, step, toolCallId, toolName);
  await emitToolInputDelta(sink, toolCallId, toolCall.function?.arguments || "{}");
  await emitToolInputStop(sink, step, toolCallId, toolName);
}
