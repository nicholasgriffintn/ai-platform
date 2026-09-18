import {
  compactChatCompletionResponseSchema,
  type CompactChatCompletionResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  acquireThread,
  threadLockError,
} from "~/modules/conversations/application/coordinator/client";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { SessionManager } from "~/modules/conversations/application/SessionManager";

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

  if (lock.acquired === false) {
    throw threadLockError(lock);
  }

  try {
    const conversationManager = ConversationManager.getInstance({
      database: context.database,
      user,
      env: context.env,
      writeFence: lock.lease,
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
    await lock.lease.release();
  }
}
