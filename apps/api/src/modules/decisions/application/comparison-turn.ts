import { stringifyMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  COMPARISON_TOOL_NAME,
  comparisonResultSchema,
  type ComparisonRequestOptions,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveComparisonSubject } from "~/modules/decisions/domain/comparison";
import { resolveExecutionRoute } from "~/modules/models/domain/execution-route";
import type { DirectedToolCall } from "~/modules/responses/application/engine/agent/agent-loop";
import { ToolCallType, type Message } from "~/types";

const UNFINISHED_COMPARISON = "The comparison did not finish. Try again.";

function readClosingReply(result: Message | undefined): string {
  if (!result) {
    return UNFINISHED_COMPARISON;
  }

  const parsed = comparisonResultSchema.safeParse(result.data);

  return parsed.success
    ? parsed.data.conclusion
    : stringifyMessageContent(result.content) || UNFINISHED_COMPARISON;
}

export function createComparisonToolCall(params: {
  messages: readonly Message[];
  options: ComparisonRequestOptions;
  modelConfig?: ModelConfigItem;
}): DirectedToolCall {
  if (
    params.modelConfig?.kind === "agent" ||
    resolveExecutionRoute(params.modelConfig) !== "hosted"
  ) {
    throw new AssistantError(
      "Comparing replies needs a hosted model. Switch models and try again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    toolCall: {
      id: generateId(),
      type: ToolCallType.FUNCTION,
      function: {
        name: COMPARISON_TOOL_NAME,
        arguments: JSON.stringify(
          resolveComparisonSubject(params.messages, params.options.sourceMessageId),
        ),
      },
    },
    readClosingReply,
  };
}
