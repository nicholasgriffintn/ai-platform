import type { FineTuningProviderId } from "@assistant/schemas";

import { BedrockFineTuneProvider } from "./BedrockFineTuneProvider.js";
import { SageMakerFineTuneProvider } from "./SageMakerFineTuneProvider.js";
import type { FineTuneProvider, FineTuneProviderContext } from "../types/providers.js";

export function createFineTuneProvider(
	provider: FineTuningProviderId,
	context: FineTuneProviderContext,
): FineTuneProvider {
	switch (provider) {
		case "aws-bedrock":
			return new BedrockFineTuneProvider(context.env);
		case "aws-sagemaker":
			return new SageMakerFineTuneProvider(context.env);
		default:
			throw new Error(`Unsupported fine-tuning provider: ${provider}`);
	}
}
