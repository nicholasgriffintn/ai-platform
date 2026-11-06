import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { findFunctionTool } from "~/modules/tools/application/catalogue";
import {
  resolveToolCallDestination,
  resolveToolCallEffectClass,
} from "~/modules/tools/application/effects";

export async function readPendingTeammateCall(
  context: ServiceContext,
  conversationId: string,
  interactionId: string,
) {
  const pending = await context.repositories
    .get(MessageRepository)
    .getLatestPendingToolMessage(conversationId);

  if (!pending || pending.tool_call_id !== interactionId || typeof pending.name !== "string") {
    return null;
  }

  const toolName = pending.name;
  const tool = findFunctionTool(toolName);

  if (!tool) {
    return null;
  }

  const { effects } = tool;
  const rawArguments = pending.tool_call_arguments;

  return {
    toolName,
    rawArguments,
    destination: resolveToolCallDestination({ effects, rawArguments }),
    effectClass: resolveToolCallEffectClass({ toolName, effects, rawArguments }),
  };
}
