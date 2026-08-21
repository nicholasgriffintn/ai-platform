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
      const exhaustiveCheck: never = stage;

      throw new AssistantError(
        `Unsupported ToolStage: ${exhaustiveCheck}`,
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  return payload;
}
