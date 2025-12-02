import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { TrainingExampleRepository } from "~/repositories/TrainingExampleRepository";
import { getLogger } from "~/utils/logger";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";

const logger = getLogger({ prefix: "services/tasks/training-quality" });

interface TrainingQualityData {
	batchSize?: number;
	minDaysOld?: number;
}

export class TrainingQualityHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const { batchSize = 50, minDaysOld = 1 } =
				message.task_data as TrainingQualityData;

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
				(example) =>
					example.quality_score === null || example.quality_score === undefined,
			);

			if (unscoredExamples.length === 0) {
				return {
					status: "skipped",
					message: "No unscored training examples found",
				};
			}

			logger.info(
				`Processing ${unscoredExamples.length} training examples for quality scoring`,
			);

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

			logger.info(
				`Quality scoring completed: ${scoredCount} scored, ${errors} errors`,
			);

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
		const prompt = `You are evaluating the quality of a training example for an AI assistant.

Rate this conversation on a scale of 1-10 where:
- 1-2: Poor quality (incorrect, harmful, or nonsensical responses)
- 3-4: Below average (partially correct but lacking clarity or completeness)
- 5-6: Average (correct but could be more helpful or detailed)
- 7-8: Good quality (accurate, helpful, and well-structured)
- 9-10: Excellent (exceptional clarity, accuracy, and helpfulness)

Consider these factors:
- Accuracy and correctness of the assistant's response
- Helpfulness and relevance to the user's prompt
- Clarity and coherence of the response
- Appropriate tone and professionalism
- Completeness of the answer

USER PROMPT:
${example.user_prompt}

ASSISTANT RESPONSE:
${example.assistant_response}

${example.system_prompt ? `SYSTEM PROMPT:\n${example.system_prompt}` : ""}

Respond with only a single number from 1-10 representing the quality score.`;

		try {
			const { model: modelToUse, provider: providerToUse } =
				await getAuxiliaryModel(env);
			const provider = getChatProvider(providerToUse, { env, user: undefined });

			const response = await provider.getResponse({
				env,
				model: modelToUse,
				messages: [{ role: "user", content: prompt }],
				max_tokens: 10,
				temperature: 0.1,
			});

			const scoreMatch = response.response.match(/(\d+)/);
			if (scoreMatch) {
				const score = parseInt(scoreMatch[1], 10);
				return Math.max(1, Math.min(10, score));
			}

			logger.warn(
				`Could not parse quality score from response: ${response.response}`,
			);
			return 5;
		} catch (error) {
			logger.error("Failed to generate quality score with AI:", error);
			return 5;
		}
	}
}
