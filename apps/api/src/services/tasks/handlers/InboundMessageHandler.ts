import { createServiceContext } from "~/lib/context/serviceContext";
import {
  handleInboundChannelMessage,
  isInboundBindingTaskData,
  parseInboundChannelTaskData,
} from "~/services/channels/inbound";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/handlers/InboundMessageHandler" });

export class InboundMessageHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const data = parseInboundChannelTaskData(message.task_data);

    if (!message.user_id || !data) {
      return {
        status: "error",
        message:
          "user_id, channel, a sender, a message id, and either a messaging provider or a channel binding are required",
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
        userId: message.user_id,
      });

      return {
        status: "skipped",
        message: "Inbound message sender is not authorised",
      };
    }

    if (result.status === "channel_unavailable") {
      logger.warn("Ignored queued inbound message for a channel that is no longer connected", {
        channel: data.channel,
        userId: message.user_id,
        ...(isInboundBindingTaskData(data) ? { bindingId: data.bindingId } : {}),
      });

      return {
        status: "skipped",
        message: "Inbound message channel is no longer connected",
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
