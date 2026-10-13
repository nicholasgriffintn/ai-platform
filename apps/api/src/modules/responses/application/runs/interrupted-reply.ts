import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { withThreadLockIfFree } from "~/modules/conversations/infrastructure/coordinator/client";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/chat-runs/interrupted-reply" });

export function buildInterruptedReply(partial: string | null, now = Date.now()): Message | null {
  if (!partial?.trim()) {
    return null;
  }

  return {
    id: generateId(),
    role: "assistant",
    content: partial,
    status: "stopped",
    timestamp: now,
  };
}

export async function salvageInterruptedReply(
  context: ServiceContext,
  run: ChatRun,
  partial: string | null,
): Promise<boolean> {
  const message = buildInterruptedReply(partial);

  if (!message) {
    return false;
  }

  try {
    const user = await context.repositories.users.getUserById(run.initiatorUserId);

    if (!user) {
      return false;
    }

    const saved = await withThreadLockIfFree(
      { env: context.env, conversationId: run.conversationId, kind: "durable_recovery" },
      async (lease) => {
        const conversationManager = ConversationManager.getInstance({
          database: context.database,
          user,
          store: true,
          env: context.env,
          writeFence: lease,
        });

        await conversationManager.add(run.conversationId, message);

        return true;
      },
    );

    return saved === true;
  } catch (error) {
    logger.warn("Could not keep the interrupted reply", {
      runId: run.id,
      error: getErrorMessage(error),
    });

    return false;
  }
}
