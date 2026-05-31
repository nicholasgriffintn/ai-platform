import type { TrainingProviderId } from "@assistant/schemas";

import { BedrockTrainingProvider } from "./BedrockTrainingProvider.js";
import { SageMakerTrainingProvider } from "./SageMakerTrainingProvider.js";
import type { TrainingProvider, TrainingProviderContext } from "../types/providers.js";

export function createTrainingProvider(
	provider: TrainingProviderId,
	context: TrainingProviderContext,
): TrainingProvider {
	switch (provider) {
		case "aws-bedrock":
			return new BedrockTrainingProvider(context.env);
		case "aws-sagemaker":
			return new SageMakerTrainingProvider(context.env);
		default:
			throw new Error(`Unsupported training provider: ${provider}`);
	}
}
