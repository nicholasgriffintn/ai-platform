import type { ModelConfig } from "../../types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "mistral";

export const mistralModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("mistral-large", PROVIDER, {
		name: "Mistral Large",
		matchingModel: "mistral-large-latest",
		description:
			"Capable in code generation, mathematics, and reasoning with support for dozens of languages.",
		type: ["text"],
		supportsFunctions: true,
		isFree: true,
		card: "https://www.prompthub.us/models/mistral-large",
		contextWindow: 128000,
		maxTokens: 4096,
		costPer1kInputTokens: 0.002,
		costPer1kOutputTokens: 0.006,
		strengths: ["chat", "analysis", "creative"],
		contextComplexity: 4,
		reliability: 4,
		speed: 3,
		isFeatured: true,
		includedInRouter: true,
		supportsArtifacts: true,
	}),

	createModelConfig("mistral-small", PROVIDER, {
		name: "Mistral Small",
		matchingModel: "mistral-small-latest",
		description:
			"Mistral Small is a lightweight model designed for cost-effective use in tasks like translation and summarization.",
		type: ["text"],
		supportsFunctions: true,
		isFree: true,
		card: "https://www.prompthub.us/models/mistral-small",
		contextWindow: 128000,
		maxTokens: 4096,
		costPer1kInputTokens: 0.002,
		costPer1kOutputTokens: 0.006,
		strengths: ["chat", "analysis", "creative", "multilingual"],
		contextComplexity: 3,
		reliability: 3,
		speed: 4,
		isFeatured: true,
		includedInRouter: true,
		supportsArtifacts: true,
	}),

	createModelConfig("mistral-nemo", PROVIDER, {
		name: "Mistral Nemo",
		matchingModel: "open-mistral-nemo",
		description:
			"Trained jointly by Mistral AI and NVIDIA, it significantly outperforms existing models smaller or similar in size.",
		type: ["text"],
		supportsFunctions: true,
		isFree: true,
		card: "https://www.prompthub.us/models/mistral-nemo",
		contextWindow: 32768,
		maxTokens: 4096,
		costPer1kInputTokens: 0.00015,
		costPer1kOutputTokens: 0.00015,
		strengths: ["chat", "analysis", "creative", "multilingual"],
		contextComplexity: 3,
		reliability: 3,
		speed: 4,
		isFeatured: true,
		includedInRouter: true,
	}),

	createModelConfig("pixtral-large", PROVIDER, {
		name: "Pixtral Large",
		matchingModel: "pixtral-large-latest",
		type: ["image-to-text"],
		supportsFunctions: true,
		card: "https://www.prompthub.us/models/pixtral",
		contextWindow: 128000,
		maxTokens: 4096,
		costPer1kInputTokens: 0.0002,
		costPer1kOutputTokens: 0.0006,
		strengths: ["vision", "multilingual"],
		contextComplexity: 4,
		reliability: 4,
		speed: 3,
		isFeatured: true,
		includedInRouter: true,
	}),

	createModelConfig("codestral", PROVIDER, {
		name: "Codestral",
		matchingModel: "codestral-latest",
		description:
			"Codestral is Mistral AI's first-ever code model designed for code generation tasks.",
		type: ["coding"],
		isFree: true,
		card: "https://www.prompthub.us/models/codestral",
		contextWindow: 32000,
		maxTokens: 4096,
		costPer1kInputTokens: 0.0002,
		costPer1kOutputTokens: 0.0006,
		strengths: ["coding", "multilingual"],
		contextComplexity: 4,
		reliability: 4,
		speed: 3,
		isFeatured: true,
		includedInRouter: true,
	}),
]);
