import { score as scoreQuestion } from "@ngriffin_uk/polychat-ai-functions";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { normaliseDecisionScore } from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/infrastructure/ai";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TrainingExampleRepository } from "~/modules/training/infrastructure/TrainingExampleRepository";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

const logger = getLogger({ prefix: "services/tasks/training-quality" });

const TRAINING_QUALITY_QUESTIONS = {
  quality: scoreQuestion(
    "How good is `assistant_response` as a reply to `user_prompt` (with `system_prompt` as context), judged on accuracy, helpfulness, clarity, tone and completeness?",
    [
      "Poor: incorrect, harmful or nonsensical",
      "Below average: partially correct but unclear or incomplete",
      "Average: correct but could be more helpful or detailed",
      "Good: accurate, helpful and well structured",
      "Excellent: exceptional clarity, accuracy and helpfulness",
    ],
  ),
} as const;

interface TrainingQualityData {
  batchSize?: number;
  minDaysOld?: number;
}

export class TrainingQualityHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    try {
      const { batchSize = 50, minDaysOld = 1 } = message.task_data as TrainingQualityData;

      const trainingRepository = new TrainingExampleRepository(env);

      const cutoffDate = new Date();

      cutoffDate.setDate(cutoffDate.getDate() - minDaysOld);

      const unscored = await trainingRepository.findMany({
        minQualityScore: undefined,
        includeInTraining: true,
        limit: batchSize,
        since: cutoffDate,
      });

      const unscoredExamples = unscored.filter(
        (example) => example.quality_score === null || example.quality_score === undefined,
      );

      if (unscoredExamples.length === 0) {
        return {
          status: "skipped",
          message: "No unscored training examples found",
        };
      }

      logger.info(`Processing ${unscoredExamples.length} training examples for quality scoring`);

      let scoredCount = 0;
      let errors = 0;

      for (const example of unscoredExamples) {
        try {
          const qualityScore = await this.scoreExample(example, env);

          await trainingRepository.updateQualityScore(example.id, qualityScore);
          scoredCount++;

          if (qualityScore < 3) {
            await trainingRepository.updateIncludeInTraining(example.id, false);
          }
        } catch (error) {
          logger.error(`Failed to score example ${example.id}:`, error);
          errors++;
        }
      }

      logger.info(`Quality scoring completed: ${scoredCount} scored, ${errors} errors`);

      return {
        status: "success",
        message: `Quality scoring completed: ${scoredCount} examples scored`,
        data: {
          scored_count: scoredCount,
          error_count: errors,
          processed_batch_size: unscoredExamples.length,
        },
      };
    } catch (error) {
      logger.error("Training quality scoring error:", error);

      return {
        status: "error",
        message: (error as Error).message,
      };
    }
  }

  private async scoreExample(example: any, env: IEnv): Promise<number> {
    const decided = await ai
      .tryDecide({
        env,
        state: {
          system_prompt: example.system_prompt ?? null,
          user_prompt: example.user_prompt,
          assistant_response: example.assistant_response,
        },
        questions: TRAINING_QUALITY_QUESTIONS,
      })
      .catch((error: unknown) => {
        logger.warn("Decision-based quality scoring failed; falling back to text scoring", {
          error,
        });

        return null;
      });

    if (decided) {
      return Math.round(1 + normaliseDecisionScore(decided.answers.quality) * 9);
    }

    const prompt = renderPrompt("apps/quality/scoring", {
      userPrompt: example.user_prompt,
      assistantResponse: example.assistant_response,
      systemPrompt: example.system_prompt,
    });

    try {
      const { model: modelToUse, provider: providerToUse, effort } = await getAuxiliaryModel(env);
      const response = await ai.generateText({
        env,
        model: modelToUse,
        provider: providerToUse,
        prompt,
        reasoning_effort: effort,
        disable_functions: true,
      });

      const scoreMatch = response.match(/(\d+)/);

      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);

        return Math.max(1, Math.min(10, score));
      }

      logger.warn(`Could not parse quality score from response: ${response}`);

      return 5;
    } catch (error) {
      logger.error("Failed to generate quality score with AI:", error);

      return 5;
    }
  }
}
