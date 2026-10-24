import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { registerBenchmarksQueue } from "~/modules/benchmarks/application/queue/register";
import { registerChannelsQueue } from "~/modules/channels/application/queue/register";
import { registerConnectorsQueue } from "~/modules/connectors/application/queue/register";
import { registerConversationsQueue } from "~/modules/conversations/application/queue/register";
import { registerDelegationsQueue } from "~/modules/delegations/application/queue/register";
import { registerDiscoverQueue } from "~/modules/discover/application/queue/register";
import { registerInfraQueue } from "~/modules/infra/application/queue/register";
import { registerJobsQueue } from "~/modules/jobs/application/queue/register";
import { registerMemoryQueue } from "~/modules/memory/application/queue/register";
import { registerModelAnalysisQueue } from "~/modules/model-analysis/application/queue/register";
import { registerModelDatasetsQueue } from "~/modules/model-datasets/application/queue/register";
import { registerModelPlatformQueue } from "~/modules/model-governance/application/queue/register";
import { registerModelRegistryQueue } from "~/modules/model-registry/application/queue/register";
import { registerNotebooksQueue } from "~/modules/notebooks/application/queue/register";
import { registerProjectTasksQueue } from "~/modules/project-tasks/application/queue/register";
import { QueueExecutor } from "~/modules/queue/application/QueueExecutor";
import { registerQueueMaintenance } from "~/modules/queue/application/register";
import type { TaskMessage } from "~/modules/queue/application/types";
import { workflows } from "~/modules/queue/application/workflows";
import { registerRealtimeQueue } from "~/modules/realtime/application/queue/register";
import { registerRecipesQueue } from "~/modules/recipes/application/queue/register";
import { registerResponsesQueue } from "~/modules/responses/application/queue/register";
import { registerSandboxQueue } from "~/modules/sandbox/application/queue/register";
import { registerSourcesQueue } from "~/modules/sources/application/queue/register";
import { registerSubscriptionQueue } from "~/modules/subscription/application/queue/register";
import { registerTaskNotificationsQueue } from "~/modules/task-notifications/application/queue/register";
import { registerTeammatesQueue } from "~/modules/teammates/application/queue/register";
import {
  isInfraUsageQueueMessage,
  rollUpInfraUsageMessages,
  type InfraUsageQueueMessage,
} from "~/modules/usage/application/infra-usage-queue";
import { registerUsageQueue } from "~/modules/usage/application/queue/register";
import { registerWebhookEndpointsQueue } from "~/modules/webhook-endpoints/application/queue/register";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "queue/consumer" });

registerSourcesQueue(workflows);
registerNotebooksQueue(workflows);
registerDiscoverQueue(workflows);
registerQueueMaintenance(workflows);
registerTaskNotificationsQueue(workflows);
registerResponsesQueue(workflows);
registerInfraQueue(workflows);
registerMemoryQueue(workflows);
registerModelDatasetsQueue(workflows);
registerModelPlatformQueue(workflows);
registerSubscriptionQueue(workflows);
registerRecipesQueue(workflows);
registerConnectorsQueue(workflows);
registerBenchmarksQueue(workflows);
registerModelAnalysisQueue(workflows);
registerConversationsQueue(workflows);
registerDelegationsQueue(workflows);
registerChannelsQueue(workflows);
registerModelRegistryQueue(workflows);
registerJobsQueue(workflows);
registerProjectTasksQueue(workflows);
registerRealtimeQueue(workflows);
registerSandboxQueue(workflows);
registerTeammatesQueue(workflows);
registerUsageQueue(workflows);
registerWebhookEndpointsQueue(workflows);

function isTaskQueueMessage(
  message: Message<TaskMessage | InfraUsageQueueMessage>,
): message is Message<TaskMessage> {
  return !isInfraUsageQueueMessage(message.body);
}

export async function consumeQueueBatch(
  env: IEnv,
  messages: readonly Message<TaskMessage | InfraUsageQueueMessage>[],
): Promise<void> {
  const taskMessages = messages.filter(isTaskQueueMessage);

  if (taskMessages.length > 0) {
    await QueueExecutor.respondToCronQueue(env, taskMessages, workflows);
  }

  const infraUsageMessages = messages.filter((message) => !isTaskQueueMessage(message));

  if (infraUsageMessages.length === 0) {
    return;
  }

  try {
    await rollUpInfraUsageMessages(env, infraUsageMessages);
  } catch (error) {
    logger.error("Failed to roll up infrastructure usage", { error });

    for (const message of infraUsageMessages) {
      message.retry();
    }
  }
}

export { workflows };
