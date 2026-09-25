import {
  CONVERSATION_TITLE_TASK_TYPE,
  DELEGATION_EXPIRY_TASK_TYPE,
  DELEGATION_MESSAGE_TASK_TYPE,
  DELEGATION_RUN_TASK_TYPE,
  DELEGATION_WAKE_TASK_TYPE,
  INFRA_RECONCILIATION_TASK_TYPE,
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  MODEL_REGISTRY_INSPECT_TASK_TYPE,
  OCR_BATCH_POLLING_TASK_TYPE,
  PROJECT_TASK_RUN_TASK_TYPE,
  REALTIME_RECONCILIATION_TASK_TYPE,
  SANDBOX_RUN_DISPATCH_TASK_TYPE,
  STRIPE_USAGE_SYNC_TASK_TYPE,
  TASK_NOTIFICATION_DELIVERY_TASK_TYPE,
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  USAGE_ROLLUP_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { TaskNotificationDeliveryHandler } from "~/modules/task-notifications/application/delivery";

import { ArtificialAnalysisIngestHandler } from "./handlers/ArtificialAnalysisIngestHandler";
import { ArtificialAnalysisScoringHandler } from "./handlers/ArtificialAnalysisScoringHandler";
import { asyncMessagePolling } from "./handlers/async-message-polling";
import { ConversationTitleHandler } from "./handlers/ConversationTitleHandler";
import { DelegationExpiryHandler } from "./handlers/DelegationExpiryHandler";
import { DelegationMessageHandler } from "./handlers/DelegationMessageHandler";
import { DelegationRunHandler } from "./handlers/DelegationRunHandler";
import { DelegationWakeHandler } from "./handlers/DelegationWakeHandler";
import { InboundMessageHandler } from "./handlers/InboundMessageHandler";
import { InfraReconciliationHandler } from "./handlers/InfraReconciliationHandler";
import { memorySynthesis } from "./handlers/memory-synthesis";
import {
  ModelRegistryEvalHandler,
  ModelRegistryInspectHandler,
} from "./handlers/ModelRegistryHandlers";
import { OcrBatchPollingHandler } from "./handlers/OcrBatchPollingHandler";
import { ProjectTaskRunHandler } from "./handlers/ProjectTaskRunHandler";
import { RealtimeReconciliationHandler } from "./handlers/RealtimeReconciliationHandler";
import { RecipeExecutionHandler } from "./handlers/RecipeExecutionHandler";
import { recordingTranscriptionPolling } from "./handlers/recording-transcription-polling";
import { replicatePolling } from "./handlers/replicate-polling";
import { researchPolling } from "./handlers/research-polling";
import { SandboxRunDispatchHandler } from "./handlers/SandboxRunDispatchHandler";
import { StripeUsageSyncHandler } from "./handlers/StripeUsageSyncHandler";
import { TeammateContextCleanupHandler } from "./handlers/TeammateContextCleanupHandler";
import { TeammateRunReconciliationHandler } from "./handlers/TeammateRunReconciliationHandler";
import { TrainingQualityHandler } from "./handlers/TrainingQualityHandler";
import { usageRollup } from "./handlers/usage-rollup";
import { workflows } from "./workflows";
import "./schedules";

workflows.on("memory_synthesis", memorySynthesis);
workflows.on(USAGE_ROLLUP_TASK_TYPE, usageRollup);

workflows.poll("research_polling", researchPolling);
workflows.poll("replicate_polling", replicatePolling);
workflows.poll("async_message_polling", asyncMessagePolling);
workflows.poll("recording_transcription_polling", recordingTranscriptionPolling);

workflows.register("training_quality_scoring", new TrainingQualityHandler());
workflows.register("recipe_execution", new RecipeExecutionHandler());
workflows.register("inbound_message", new InboundMessageHandler());
workflows.register("artificial_analysis_ingest", new ArtificialAnalysisIngestHandler());
workflows.register("artificial_analysis_scoring", new ArtificialAnalysisScoringHandler());
workflows.register(SANDBOX_RUN_DISPATCH_TASK_TYPE, new SandboxRunDispatchHandler());
workflows.register(PROJECT_TASK_RUN_TASK_TYPE, new ProjectTaskRunHandler());
workflows.register(DELEGATION_RUN_TASK_TYPE, new DelegationRunHandler());
workflows.register(DELEGATION_MESSAGE_TASK_TYPE, new DelegationMessageHandler());
workflows.register(DELEGATION_EXPIRY_TASK_TYPE, new DelegationExpiryHandler());
workflows.register(DELEGATION_WAKE_TASK_TYPE, new DelegationWakeHandler());
workflows.register(OCR_BATCH_POLLING_TASK_TYPE, new OcrBatchPollingHandler());
workflows.register(REALTIME_RECONCILIATION_TASK_TYPE, new RealtimeReconciliationHandler());
workflows.register(INFRA_RECONCILIATION_TASK_TYPE, new InfraReconciliationHandler());
workflows.register(STRIPE_USAGE_SYNC_TASK_TYPE, new StripeUsageSyncHandler());
workflows.register(TASK_NOTIFICATION_DELIVERY_TASK_TYPE, new TaskNotificationDeliveryHandler());
workflows.register(TEAMMATE_RUN_RECONCILIATION_TASK_TYPE, new TeammateRunReconciliationHandler());
workflows.register(TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE, new TeammateContextCleanupHandler());
workflows.register(CONVERSATION_TITLE_TASK_TYPE, new ConversationTitleHandler());
workflows.register(MODEL_REGISTRY_INSPECT_TASK_TYPE, new ModelRegistryInspectHandler());
workflows.register(MODEL_REGISTRY_EVAL_TASK_TYPE, new ModelRegistryEvalHandler());

export { workflows };
