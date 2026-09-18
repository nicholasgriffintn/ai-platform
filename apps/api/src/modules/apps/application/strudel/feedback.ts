import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const logger = getLogger({ prefix: "services/strudel/feedback" });

export interface StrudelFeedbackRequest {
  context: ServiceContext;
  userId: number;
  generationId: string;
  score?: number;
  feedback?: string;
}

export async function submitStrudelFeedback(
  request: StrudelFeedbackRequest,
): Promise<{ success: boolean; message: string }> {
  const { context, userId, generationId, score, feedback } = request;

  if (!generationId) {
    throw new AssistantError("Generation ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!score && !feedback) {
    throw new AssistantError("Either score or feedback must be provided", ErrorType.PARAMS_ERROR);
  }

  try {
    const trainingExamples = await context.repositories.trainingExamples.findMany({
      userId,
      conversationId: generationId,
      source: "app",
      appName: "strudel",
      limit: 1,
    });

    if (trainingExamples.length === 0) {
      logger.warn("No training example found for Strudel generation", {
        generationId,
      });
      throw new AssistantError("Generation not found for feedback", ErrorType.NOT_FOUND);
    }

    const example = trainingExamples[0];
    const updateData: any = {};

    if (score !== undefined) {
      updateData.feedback_rating = score;
    }

    if (feedback) {
      updateData.feedback_comment = feedback;
    }

    await context.repositories.trainingExamples.updateById(example.id, updateData);

    logger.info("Updated Strudel generation with feedback", {
      exampleId: example.id,
      generationId,
      score,
    });

    return {
      success: true,
      message: "Feedback submitted successfully",
    };
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    logger.error("Failed to submit Strudel feedback", {
      error: getErrorMessage(error),
      generationId,
    });

    throw new AssistantError("Failed to submit feedback", ErrorType.UNKNOWN_ERROR);
  }
}
