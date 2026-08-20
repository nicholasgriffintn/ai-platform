import {
  compactChatCompletionResponseSchema,
  type CompactChatCompletionResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { SessionManager } from "~/lib/session/SessionManager";
import { acquireThread, releaseThread } from "~/services/conversations/coordinator/client";
import { AssistantError, ErrorType } from "~/utils/errors";

export type CompactChatCompletionContext = Pick<
  ServiceContext,
  "database" | "ensureDatabase" | "env" | "requireUser"
>;

export async function handleCompactChatCompletion(
  context: CompactChatCompletionContext,
  completion_id: string,
): Promise<CompactChatCompletionResponse> {
  const user = context.requireUser();

  context.ensureDatabase();

  const lock = await acquireThread({
    env: context.env,
    conversationId: completion_id,
    kind: "compact",
  });

  if (!lock.acquired) {
    throw new AssistantError(
      "This conversation is busy. Try compacting again once the current response finishes.",
      ErrorType.CONFLICT_ERROR,
    );
  }

  try {
    const conversationManager = ConversationManager.getInstance({
      database: context.database,
      user,
      env: context.env,
    });

    const messages = await conversationManager.getAllMessages(completion_id, {
      includeArchived: false,
    });
    const sessionManager = new SessionManager({
      env: context.env,
      conversationManager,
      user,
    });
    const compactedSession = await sessionManager.compact({
      completionId: completion_id,
      messages,
      compaction: "manual",
      mode: messages.at(-1)?.mode,
    });

    const conversation = await conversationManager.getConversationDetails(completion_id, {
      includeArchived: true,
      includeSnapshots: false,
    });

    return compactChatCompletionResponseSchema.parse({
      compacted: compactedSession.compacted,
      conversation,
    });
  } finally {
    await releaseThread({ env: context.env, conversationId: completion_id });
  }
}
