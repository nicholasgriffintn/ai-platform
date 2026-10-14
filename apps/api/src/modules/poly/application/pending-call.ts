import type { TeammateContext } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  resolveToolCallDestination,
  resolveToolCallEffectClass,
} from "~/modules/chat/application/tools/effects";
import { resolveFunctionTool } from "~/modules/functions/application";

export async function readPendingPolyCall(
  context: ServiceContext,
  polyContext: TeammateContext,
  interactionId: string,
) {
  const pending = await context.repositories.messages.getLatestPendingToolMessage(
    polyContext.homeConversationId,
  );

  if (!pending || pending.tool_call_id !== interactionId || typeof pending.name !== "string") {
    return null;
  }

  const toolName = pending.name;
  const effects = resolveFunctionTool(toolName).effects;
  const rawArguments = pending.tool_call_arguments;

  return {
    toolName,
    destination: resolveToolCallDestination({ effects, rawArguments }),
    effectClass: resolveToolCallEffectClass({ toolName, effects, rawArguments }),
  };
}
