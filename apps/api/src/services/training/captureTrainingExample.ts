import type { ServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";
import type { CreateTrainingExampleData } from "~/repositories/TrainingExampleRepository";
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
		startTime,
		previousMessages,
		userBehavior,
		skipEnhancement = false,
	} = options;

	try {
		const userId = context.user?.id;

		if (userId) {
			const userSettings =
				await context.repositories.userSettings.getUserSettings(userId);

			if (!userSettings?.tracking_enabled) {
				return;
			}
		}

		if (!assistantResponse || assistantResponse.trim().length === 0) {
			return;
		}

		logger.debug("Capturing training example", {
			source,
			appName,
			userId: userId || "anonymous",
			promptLength: userPrompt.length,
			responseLength: assistantResponse.length,
		});

		let enhancedMetadata: EnhancedMetadata = {};
		if (!skipEnhancement) {
			try {
				enhancedMetadata = await createEnhancedTrainingMetadata(
					context,
					userPrompt,
					assistantResponse,
					{
						conversationId,
						startTime,
						previousMessages,
						userBehavior,
					},
				);
			} catch (error) {
				logger.warn(
					"Failed to generate enhanced metadata, proceeding without it",
					{
						error: error instanceof Error ? error.message : String(error),
					},
				);
			}
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
			...enhancedMetadata,
		};

		await context.repositories.trainingExamples.create(trainingData);

		logger.debug("Training example captured", {
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
