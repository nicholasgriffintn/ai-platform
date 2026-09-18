import {
  getLogger,
  type AiFeedbackSignal,
  type Telemetry,
  type TelemetryEnv,
  type TelemetryIdentity,
} from "@ngriffin_uk/polychat-ai-telemetry";
import type { SubmitChatCompletionFeedbackInput } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { TrainingExampleRepository } from "~/infrastructure/database/repositoryManager";
import { createTelemetry } from "~/infrastructure/telemetry";
import {
  resolveFeedbackTarget,
  type ChatFeedbackTargetMessage,
} from "~/modules/completions/application/feedback-target";

const logger = getLogger({
  prefix: "services/chatCompletionFeedbackSubmission",
});

export interface ChatFeedbackContext {
  env: TelemetryEnv;
  user?: TelemetryIdentity["user"];
  anonymousUser?: TelemetryIdentity["anonymousUser"];
  messages: ChatFeedbackTargetMessage[];
  repositories: {
    trainingExamples: Pick<TrainingExampleRepository, "findMany" | "updateById">;
  };
}

export interface ChatCompletionFeedbackOptions {
  request: SubmitChatCompletionFeedbackInput;
  completion_id: string;
  telemetry?: Pick<Telemetry, "captureAiFeedback">;
}

export const handleChatCompletionFeedbackSubmission = async (
  context: ChatFeedbackContext,
  { request, completion_id, telemetry }: ChatCompletionFeedbackOptions,
): Promise<{ success: boolean; message: string; completion_id: string }> => {
  const target = resolveFeedbackTarget(context.messages, request);

  if (!target || target.role === "user") {
    throw new AssistantError("Feedback target not found", ErrorType.NOT_FOUND, 404);
  }

  const signal: AiFeedbackSignal = {
    traceId: target.run_id ?? completion_id,
    conversationId: completion_id,
    messageId: target.id,
    logId: target.log_id ?? request.log_id,
    feedback: request.feedback,
    score: request.score,
    user: context.user,
    anonymousUser: context.anonymousUser,
  };

  try {
    const feedbackTelemetry = telemetry ?? createTelemetry(context.env);

    await feedbackTelemetry.captureAiFeedback(signal);
  } catch (error) {
    logger.error("Failed to capture chat feedback", {
      error: getErrorMessage(error),
      completionId: completion_id,
      messageId: target.id,
      logId: signal.logId,
    });
  }

  try {
    const trainingExamples = await context.repositories.trainingExamples.findMany({
      conversationId: completion_id,
      source: "chat",
      limit: 1,
    });
    const [example] = trainingExamples;

    if (example) {
      await context.repositories.trainingExamples.updateById(example.id, {
        feedback_rating: request.feedback === 1 ? 5 : 1,
      });
      logger.info("Updated training example with feedback", {
        exampleId: example.id,
        completionId: completion_id,
        feedback: request.feedback,
      });
    }
  } catch (error) {
    logger.error("Failed to update training example with feedback", {
      error: getErrorMessage(error),
      completionId: completion_id,
    });
  }

  return {
    success: true,
    message: "Feedback submitted successfully",
    completion_id,
  };
};
