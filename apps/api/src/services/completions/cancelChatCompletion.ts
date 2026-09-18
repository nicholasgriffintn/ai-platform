import type { ExecutionContext } from "@cloudflare/workers-types";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { recordTurnCancellationRequested } from "~/services/chat/streaming/continuity-telemetry";
import { requestTurnCancellation } from "~/services/chat/streaming/turn-cancellation";
import { ConversationManager } from "~/services/conversations/manager";

export type CancelChatCompletionContext = Pick<
  ServiceContext,
  "database" | "ensureDatabase" | "env" | "requestCache" | "requireUser"
>;

export async function handleCancelChatCompletion(
  context: CancelChatCompletionContext,
  completion_id: string,
  options: { executionCtx?: ExecutionContext; platform?: string | null } = {},
): Promise<{ cancelled: true; completion_id: string }> {
  const user = context.requireUser();

  if (!completion_id) {
    throw new AssistantError("Missing completion_id", ErrorType.PARAMS_ERROR);
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    requestCache: context.requestCache,
  });

  try {
    await conversationManager.get(completion_id);
  } catch {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }

  await requestTurnCancellation(context.env, completion_id);
  recordTurnCancellationRequested(
    {
      env: context.env,
      executionCtx: options.executionCtx,
      traceId: completion_id,
    },
    options.platform,
  );

  return { cancelled: true, completion_id };
}
