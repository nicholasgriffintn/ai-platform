import type { ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { formatStoredMessage } from "~/lib/conversation/stored-message";
import { normaliseTokenUsage } from "~/lib/usage/tokenUsage";
import type { CreateChatCompletionsResponse } from "~/types";

import { reconcileInactiveChatRun } from "./recovery";

const EMPTY_USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
};

export async function recoverChatCompletionResponse(
  context: ServiceContext,
  receipt: ChatRunCommandReceipt,
): Promise<
  | { state: "in_progress"; response: CreateChatCompletionsResponse }
  | { state: "recovered"; response: CreateChatCompletionsResponse }
> {
  const run = await reconcileInactiveChatRun(context, receipt.run);
  const authoritativeReceipt = run === receipt.run ? receipt : { ...receipt, run };
  const inProgress =
    run.status === "accepted" || run.status === "running" || run.status === "cancelling";
  const rows = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const selected =
    rows.find((row) => row.id === run.lastMessageId && row.role === "assistant") ??
    [...rows].reverse().find((row) => row.role === "assistant");
  const message = selected ? formatStoredMessage(selected) : null;
  const content =
    message?.content ??
    (inProgress
      ? ""
      : (run.terminalReason ?? "The accepted run finished without a text response."));
  const logId = message?.log_id ?? run.id;

  const response: CreateChatCompletionsResponse = {
    id: message?.id ?? run.id,
    log_id: logId,
    object: "chat.completion",
    created: Date.now(),
    ...(message?.model ? { model: message.model } : {}),
    choices: [
      {
        index: 0,
        message: {
          ...(message?.id ? { id: message.id } : {}),
          log_id: logId,
          role: "assistant",
          content,
          ...(message?.parts ? { parts: message.parts } : {}),
          ...(message?.data !== undefined ? { data: message.data } : {}),
          ...(message?.tool_calls ? { tool_calls: message.tool_calls } : {}),
          ...(message?.citations ? { citations: message.citations } : {}),
          ...(message?.status ? { status: message.status } : {}),
          ...(message?.timestamp ? { timestamp: message.timestamp } : {}),
          ...(message?.provenance !== undefined ? { provenance: message.provenance } : {}),
        },
        finish_reason: message?.tool_calls?.length ? "tool_calls" : "stop",
      },
    ],
    usage: normaliseTokenUsage(message?.usage) ?? EMPTY_USAGE,
    run: authoritativeReceipt,
  };

  return inProgress ? { state: "in_progress", response } : { state: "recovered", response };
}

export async function recoverAcceptedChatCompletionResponse(
  context: ServiceContext,
  params: { userId: number; commandId: string; conversationId: string },
): Promise<Awaited<ReturnType<typeof recoverChatCompletionResponse>> | null> {
  const receipt = await context.repositories.conversationRuns.getCommandReceipt(
    params.userId,
    params.commandId,
  );

  if (receipt?.run.conversationId !== params.conversationId) {
    return null;
  }

  return recoverChatCompletionResponse(context, receipt);
}
