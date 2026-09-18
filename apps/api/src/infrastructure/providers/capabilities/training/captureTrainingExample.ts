import {
  createTelemetry,
  getLogger,
  type TelemetrySink,
  type TrainingExampleSignal,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { CreateTrainingExampleData } from "~/modules/training/infrastructure/TrainingExampleRepository";

import {
  createEnhancedTrainingMetadata,
  type UserSatisfactionSignals,
  type EnhancedMetadata,
} from "./metadataEnhancer";

const logger = getLogger({ prefix: "services/training/capture" });

interface CaptureTrainingExampleOptions {
  context: ServiceContext;
  source: "chat" | "app";
  appName?: string;
  userPrompt: string;
  assistantResponse: string;
  systemPrompt?: string;
  modelUsed?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
  startTime?: number;
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  userBehavior?: UserSatisfactionSignals;
  skipEnhancement?: boolean;
}

export function createTrainingExampleSink(
  context: ServiceContext,
  options: { skipEnhancement?: boolean } = {},
): TelemetrySink {
  return {
    name: "training_examples",
    captureTrainingExample: async (signal) => {
      const userId = signal.user?.id ?? context.user?.id;

      if (userId) {
        const userSettings = await context.repositories.userSettings.getUserSettings(userId);

        if (!userSettings?.tracking_enabled) {
          return;
        }
      }

      if (!signal.assistantResponse || signal.assistantResponse.trim().length === 0) {
        return;
      }

      logger.debug("Capturing training example", {
        source: signal.source,
        appName: signal.appName,
        userId: userId || "anonymous",
        promptLength: signal.userPrompt.length,
        responseLength: signal.assistantResponse.length,
      });

      let enhancedMetadata: EnhancedMetadata = {};

      if (!options.skipEnhancement) {
        try {
          enhancedMetadata = await createEnhancedTrainingMetadata(
            context,
            signal.userPrompt,
            signal.assistantResponse,
            {
              conversationId: signal.conversationId,
              startTime: signal.startedAt,
              previousMessages: signal.previousMessages as Array<{
                role: "user" | "assistant";
                content: string;
              }>,
              userBehavior: signal.userBehaviour,
            },
          );
        } catch (error) {
          logger.warn("Failed to generate enhanced metadata, proceeding without it", {
            error: getErrorMessage(error),
          });
        }
      }

      const trainingData: CreateTrainingExampleData = {
        userId: userId || undefined,
        conversationId: signal.conversationId,
        source: signal.source as CaptureTrainingExampleOptions["source"],
        appName: signal.appName || undefined,
        userPrompt: signal.userPrompt,
        assistantResponse: signal.assistantResponse,
        systemPrompt: signal.systemPrompt,
        modelUsed: signal.model,
        metadata: signal.metadata,
        includeInTraining: true,
        ...enhancedMetadata,
      };

      await context.repositories.trainingExamples.create(trainingData);

      logger.debug("Training example captured", {
        source: signal.source,
        appName: signal.appName,
        userId: userId || "anonymous",
        promptLength: signal.userPrompt.length,
        responseLength: signal.assistantResponse.length,
      });
    },
  };
}

export async function captureTrainingExample(
  options: CaptureTrainingExampleOptions,
): Promise<void> {
  const { context, skipEnhancement = false } = options;
  const signal: TrainingExampleSignal = {
    source: options.source,
    appName: options.appName ?? "",
    userPrompt: options.userPrompt,
    assistantResponse: options.assistantResponse,
    systemPrompt: options.systemPrompt,
    model: options.modelUsed,
    conversationId: options.conversationId,
    startedAt: options.startTime,
    previousMessages: options.previousMessages,
    metadata: options.metadata,
    userBehaviour: options.userBehavior ? { ...options.userBehavior } : undefined,
    user: context.user ? { id: context.user.id, email: context.user.email } : undefined,
  };
  const telemetry = createTelemetry({
    sinks: [createTrainingExampleSink(context, { skipEnhancement })],
    onSinkError: (sink, error) =>
      logger.error("Failed to capture training example", {
        error: getErrorMessage(error),
        sink,
        source: options.source,
        appName: options.appName,
      }),
  });

  await telemetry.captureTrainingExample(signal);
}
