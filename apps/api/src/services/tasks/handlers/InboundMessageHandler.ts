import { createServiceContext } from "~/lib/context/serviceContext";
import {
  handleInboundChannelMessage,
  type InboundChannelTaskData,
} from "~/services/channels/inbound";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/handlers/InboundMessageHandler" });

export class InboundMessageHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const data = message.task_data as InboundChannelTaskData;

    if (!message.user_id || !data?.channel || !data.providerId || !data.providerSettingsId) {
      return {
        status: "error",
        message: "user_id, channel, providerId, and providerSettingsId are required",
      };
    }

    if (!data.message?.from || !data.message.messageId) {
      return {
        status: "error",
        message: "Inbound message is missing a sender or message id",
      };
    }

    const baseContext = createServiceContext({ env });
    const user = await baseContext.repositories.users.getUserById(message.user_id);

    if (!user) {
      return {
        status: "error",
        message: `User ${message.user_id} not found for inbound ${data.channel} message`,
      };
    }

    const context = createServiceContext({ env, user });
    const result = await handleInboundChannelMessage({ env, context, user, data });

    if (result.status === "unauthorised_sender") {
      logger.warn("Ignored queued inbound message from an unauthorised sender", {
        channel: data.channel,
        providerId: data.providerId,
        userId: message.user_id,
      });

      return {
        status: "skipped",
        message: "Inbound message sender is not authorised",
      };
    }

    return {
      status: "success",
      message: `Inbound ${data.channel} message answered`,
      data: {
        channel: data.channel,
        conversationId: result.conversationId,
      },
    };
  }
}
