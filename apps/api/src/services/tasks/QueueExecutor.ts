import {
  INFRA_RECONCILIATION_TASK_TYPE,
  PROJECT_TASK_RUN_TASK_TYPE,
  OCR_BATCH_POLLING_TASK_TYPE,
  REALTIME_RECONCILIATION_TASK_TYPE,
  SANDBOX_RUN_DISPATCH_TASK_TYPE,
  STRIPE_USAGE_SYNC_TASK_TYPE,
  USAGE_ROLLUP_TASK_TYPE,
  type TaskType,
} from "@ngriffin_uk/polychat-schemas";

import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import { ArtificialAnalysisIngestHandler } from "./handlers/ArtificialAnalysisIngestHandler";
import { ArtificialAnalysisScoringHandler } from "./handlers/ArtificialAnalysisScoringHandler";
import { AsyncMessagePollingHandler } from "./handlers/AsyncMessagePollingHandler";
import { InboundMessageHandler } from "./handlers/InboundMessageHandler";
import { InfraReconciliationHandler } from "./handlers/InfraReconciliationHandler";
import { MemorySynthesisHandler } from "./handlers/MemorySynthesisHandler";
import { OcrBatchPollingHandler } from "./handlers/OcrBatchPollingHandler";
import { PodcastTranscriptionPollingHandler } from "./handlers/PodcastTranscriptionPollingHandler";
import { ProjectTaskRunHandler } from "./handlers/ProjectTaskRunHandler";
import { RealtimeReconciliationHandler } from "./handlers/RealtimeReconciliationHandler";
import { RecipeExecutionHandler } from "./handlers/RecipeExecutionHandler";
import { ReplicatePollingHandler } from "./handlers/ReplicatePollingHandler";
import { ResearchPollingHandler } from "./handlers/ResearchPollingHandler";
import { SandboxRunDispatchHandler } from "./handlers/SandboxRunDispatchHandler";
import { StripeUsageSyncHandler } from "./handlers/StripeUsageSyncHandler";
import { TrainingQualityHandler } from "./handlers/TrainingQualityHandler";
import { UsageRollupHandler } from "./handlers/UsageRollupHandler";
import { TaskExecutor } from "./TaskExecutor";
import type { TaskHandler } from "./TaskHandler";
import type { TaskMessage } from "./TaskService";
import { MAX_QUEUE_DELAY_SECONDS } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/queue-executor" });

export function createTaskHandlers(): Map<TaskType, TaskHandler> {
  return new Map<TaskType, TaskHandler>([
    ["memory_synthesis", new MemorySynthesisHandler()],
    ["research_polling", new ResearchPollingHandler()],
    ["replicate_polling", new ReplicatePollingHandler()],
    ["async_message_polling", new AsyncMessagePollingHandler()],
    ["podcast_transcription_polling", new PodcastTranscriptionPollingHandler()],
    ["training_quality_scoring", new TrainingQualityHandler()],
    ["recipe_execution", new RecipeExecutionHandler()],
    ["inbound_message", new InboundMessageHandler()],
    ["artificial_analysis_ingest", new ArtificialAnalysisIngestHandler()],
    ["artificial_analysis_scoring", new ArtificialAnalysisScoringHandler()],
    [SANDBOX_RUN_DISPATCH_TASK_TYPE, new SandboxRunDispatchHandler()],
    [PROJECT_TASK_RUN_TASK_TYPE, new ProjectTaskRunHandler()],
    [OCR_BATCH_POLLING_TASK_TYPE, new OcrBatchPollingHandler()],
    [USAGE_ROLLUP_TASK_TYPE, new UsageRollupHandler()],
    [REALTIME_RECONCILIATION_TASK_TYPE, new RealtimeReconciliationHandler()],
    [INFRA_RECONCILIATION_TASK_TYPE, new InfraReconciliationHandler()],
    [STRIPE_USAGE_SYNC_TASK_TYPE, new StripeUsageSyncHandler()],
  ]);
}

export class QueueExecutor {
  public static async respondToCronQueue(
    env: IEnv,
    batch: MessageBatch<TaskMessage>,
  ): Promise<void> {
    logger.info(`Processing batch of ${batch.messages.length} tasks`);

    const handlers = createTaskHandlers();
    const taskExecutor = new TaskExecutor(env, handlers);
    const taskRepository = new TaskRepository(env);

    for (const message of batch.messages) {
      try {
        if (message.body.scheduled_at) {
          const scheduledAtMs = Date.parse(message.body.scheduled_at);

          if (Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now()) {
            const remainingSeconds = Math.ceil((scheduledAtMs - Date.now()) / 1000);

            logger.info(`Task ${message.body.taskId} is scheduled for later, retrying delivery`);
            message.retry({ delaySeconds: Math.min(remainingSeconds, MAX_QUEUE_DELAY_SECONDS) });
            continue;
          }
        }

        logger.info(`Processing task ${message.body.taskId} of type ${message.body.task_type}`);

        await taskExecutor.execute(message.body, message.attempts);

        message.ack();

        logger.info(`Task ${message.body.taskId} acknowledged`);
      } catch (error) {
        logger.error(`Error processing task ${message.body.taskId}:`, error);
        const task = await taskRepository.getTaskById(message.body.taskId);

        if (!task || task.status === "failed" || task.status === "cancelled") {
          logger.error(`Task ${message.body.taskId} reached terminal state, acknowledging message`);
          await taskExecutor.handleFailure(message.body, error as Error);
          message.ack();
          continue;
        }

        logger.info(`Retrying task ${message.body.taskId}`);
        message.retry();
      }
    }

    logger.info(`Finished processing batch of tasks`);
  }
}
