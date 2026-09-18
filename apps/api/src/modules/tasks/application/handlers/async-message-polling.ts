import type { AsyncInvocationMetadata } from "@ngriffin_uk/polychat-ai-providers";
import { isAsyncInvocationPending } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { z } from "zod/v4";

import { Database } from "~/infrastructure/database";
import { handleAsyncInvocation } from "~/modules/completions/application/async/handler";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { withThreadLockIfFree } from "~/modules/conversations/infrastructure/coordinator/client";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { definePoll } from "../workflows";

const logger = getLogger({ prefix: "services/tasks/async-message-polling" });

export const asyncMessagePolling = definePoll({
  payload: z.object({
    conversationId: z.string().min(1),
    messageId: z.string().min(1),
    asyncInvocation: z.custom<AsyncInvocationMetadata>(isRecord),
    userId: z.number(),
    pollAttempt: z.number().optional(),
  }),
  check: async (data, { env }) => {
    const database = new Database(env);

    const userRepository = new UserRepository(env);
    const user = await userRepository.getUserById(data.userId);

    if (!user) {
      return {
        status: "error",
        message: `User ${data.userId} not found`,
      };
    }

    const conversationManager = ConversationManager.getInstance({
      database,
      user,
      store: true,
      env,
    });

    const messages = await conversationManager.getAllMessages(data.conversationId, {
      includeArchived: true,
    });
    const targetMessage = messages.find((m) => m.id === data.messageId);

    if (!targetMessage) {
      return {
        status: "error",
        message: `Message ${data.messageId} not found in conversation`,
      };
    }

    const messageAsyncInvocation = (targetMessage.data as Record<string, any> | undefined)
      ?.asyncInvocation as AsyncInvocationMetadata | undefined;

    if (!messageAsyncInvocation || !isAsyncInvocationPending(messageAsyncInvocation)) {
      logger.info(`Message ${data.messageId} is not pending async invocation`);

      return {
        status: "success",
        message: "Message not pending async invocation",
        data: {
          messageId: data.messageId,
          status: targetMessage.status,
        },
      };
    }

    const result = await withThreadLockIfFree(
      { env, conversationId: data.conversationId, kind: "async_result" },
      (lease) =>
        handleAsyncInvocation(data.asyncInvocation, targetMessage, {
          conversationManager: ConversationManager.getInstance({
            database,
            user,
            store: true,
            env,
            writeFence: lease,
          }),
          conversationId: data.conversationId,
          env,
          user,
        }),
    );

    if (result && (result.status === "completed" || result.status === "failed")) {
      logger.info(`Async invocation for message ${data.messageId} ${result.status}`);

      return {
        status: "success",
        message: `Async invocation ${result.status}`,
        data: {
          messageId: data.messageId,
          invocationStatus: result.status,
        },
      };
    }

    logger.info(`Async invocation for message ${data.messageId} still in progress, re-queuing`);

    return PENDING;
  },
});
