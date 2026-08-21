import { normaliseTokenUsage } from "~/lib/usage/tokenUsage";
import type { AssistantMessageData } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/messages/assistant-format" });

export function formatAssistantMessage({
  content = "",
  thinking = "",
  signature = "",
  citations = [],
  tool_calls = [],
  data = null,
  usage = null,
  guardrails = { passed: true },
  log_id = null,
  model = "",
  selected_models = [],
  platform = "api",
  timestamp = Date.now(),
  id = generateId(),
  finish_reason = null,
  mode,
  refusal = null,
  annotations = null,
}: Partial<AssistantMessageData>): AssistantMessageData {
  if (tool_calls && !Array.isArray(tool_calls)) {
    logger.warn("Invalid tool_calls format, expected array", {
      tool_calls,
    });
    tool_calls = [];
  }

  if (citations && !Array.isArray(citations)) {
    logger.warn("Invalid citations format, expected array", {
      citations,
    });
    citations = [];
  }

  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    logger.warn("Invalid timestamp, using current time", { timestamp });
    timestamp = Date.now();
  }

  const determinedFinishReason = finish_reason || (tool_calls?.length ? "tool_calls" : "stop");

  const finalUsage = normaliseTokenUsage(usage) || {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
  };

  let messageContent: string | Array<any> = content;

  if (thinking || signature) {
    const contentBlocks = [];

    if (thinking) {
      contentBlocks.push({
        type: "thinking",
        thinking,
        signature: signature || "",
      });
    }

    if (content) {
      contentBlocks.push({
        type: "text",
        text: content,
      });
    }

    messageContent = contentBlocks;
  }

  return {
    content: messageContent,
    thinking,
    signature,
    citations,
    tool_calls,
    data,
    usage: finalUsage,
    guardrails,
    log_id,
    model,
    selected_models,
    platform,
    timestamp,
    id,
    finish_reason: determinedFinishReason,
    mode,
    refusal,
    annotations,
  };
}
