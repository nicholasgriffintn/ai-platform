import type { ServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";
import type { CreateTrainingExampleData } from "~/repositories/TrainingExampleRepository";

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
}

export async function captureTrainingExample(
	options: CaptureTrainingExampleOptions,
): Promise<void> {
	const {
		context,
		source,
		appName,
		userPrompt,
		assistantResponse,
		systemPrompt,
		modelUsed,
		conversationId,
		metadata,
	} = options;

	try {
		const userId = context.user?.id;

		if (userId) {
			const userSettings =
				await context.repositories.userSettings.getUserSettings(userId);

			if (!userSettings?.tracking_enabled) {
				logger.debug(
					"Skipping training example capture - user has opted out of tracking",
					{ userId },
				);
				return;
			}
		}

		if (!assistantResponse || assistantResponse.trim().length === 0) {
			logger.debug(
				"Skipping training example capture - empty assistant response",
			);
			return;
		}

		const trainingData: CreateTrainingExampleData = {
			userId: userId || undefined,
			conversationId,
			source,
			appName,
			userPrompt,
			assistantResponse,
			systemPrompt,
			modelUsed,
			metadata,
			includeInTraining: true,
		};

		await context.repositories.trainingExamples.create(trainingData);

		logger.info("Training example captured", {
			source,
			appName,
			userId: userId || "anonymous",
			promptLength: userPrompt.length,
			responseLength: assistantResponse.length,
		});
	} catch (error) {
		logger.error("Failed to capture training example", {
			error: error instanceof Error ? error.message : String(error),
			source,
			appName,
		});
	}
}
