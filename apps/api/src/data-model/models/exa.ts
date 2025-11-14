import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "exa";

export const exaModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("exa", PROVIDER, {
		name: "Exa",
		matchingModel: "exa",
		description:
			"Exa is the first meaning-based web search API powered by embeddings. It unlocks data no other search can, making your AI more relevant, factual, and reducing hallucinations.",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsTemperature: false,
		supportsReasoning: false,
		supportsToolCalls: false,
		strengths: ["chat", "search", "general_knowledge"],
		contextComplexity: 3,
		reliability: 4,
		speed: 4,
		includedInRouter: true,
		supportsArtifacts: true,
	}),
	createModelConfig("exa-research", PROVIDER, {
		name: "Exa Research",
		matchingModel: "exa-research",
		description:
			"Exa is the first meaning-based web search API powered by embeddings. It unlocks data no other search can, making your AI more relevant, factual, and reducing hallucinations.",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsTemperature: false,
		supportsReasoning: false,
		supportsToolCalls: false,
		strengths: ["chat", "search", "general_knowledge", "research"],
		contextComplexity: 4,
		reliability: 4,
		speed: 4,
		includedInRouter: true,
		supportsArtifacts: true,
	}),
	createModelConfig("exa-research-pro", PROVIDER, {
		name: "Exa Research Pro",
		matchingModel: "exa-research-pro",
		description:
			"Exa is the first meaning-based web search API powered by embeddings. It unlocks data no other search can, making your AI more relevant, factual, and reducing hallucinations.",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsTemperature: false,
		supportsReasoning: false,
		supportsToolCalls: false,
		strengths: ["chat", "search", "general_knowledge", "research"],
		contextComplexity: 5,
		reliability: 4,
		speed: 3,
		includedInRouter: true,
		supportsArtifacts: true,
	}),
]);
