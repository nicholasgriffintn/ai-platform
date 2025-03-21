import type { ModelConfig } from "../../types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "anthropic";

export const anthropicModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("claude-3.5-sonnet", PROVIDER, {
		name: "Claude 3.5 Sonnet",
		matchingModel: "claude-3-5-sonnet-latest",
		type: ["text"],
	}),

	createModelConfig("claude-3.7-sonnet", PROVIDER, {
		name: "Claude 3.7 Sonnet",
		matchingModel: "claude-3-7-sonnet-latest",
		description:
			"Combined with state-of-the-art coding, vision, and writing skills, you can use this model for a variety of use cases.",
		type: ["text"],
		card: "https://www.prompthub.us/models/claude-3-7-sonnet",
		contextWindow: 200000,
		maxTokens: 8192,
		costPer1kInputTokens: 0.003,
		costPer1kOutputTokens: 0.015,
		strengths: ["chat", "analysis", "coding", "reasoning", "creative"],
		contextComplexity: 5,
		reliability: 5,
		speed: 4,
		multimodal: true,
		hasThinking: true,
		isFeatured: true,
		includedInRouter: true,
		supportsArtifacts: true,
	}),

	createModelConfig("claude-3.5-haiku", PROVIDER, {
		name: "Claude 3.5 Haiku",
		matchingModel: "claude-3-5-haiku-latest",
		description:
			"With fast speeds, improved instruction following, and more accurate tool use, Claude 3.5 Haiku is well suited for user-facing products, specialized sub-agent tasks, and generating personalized experiences from huge volumes of data.",
		type: ["text"],
		card: "https://www.prompthub.us/models/claude-3-5-haiku",
		contextWindow: 80000,
		maxTokens: 8192,
		costPer1kInputTokens: 0.001,
		costPer1kOutputTokens: 0.005,
		strengths: ["chat", "analysis", "reasoning", "creative"],
		contextComplexity: 3,
		reliability: 3,
		speed: 5,
		isFeatured: true,
		includedInRouter: true,
	}),

	createModelConfig("claude-3-opus", PROVIDER, {
		name: "Claude 3 Opus",
		matchingModel: "claude-3-opus-latest",
		description:
			"The Claude 3.5 Opus is an advanced AI model by Anthropic designed for enterprise-level applications. It offers unmatched performance in handling complex tasks, making it an ideal solution for businesses requiring high-level data processing and analysis.",
		type: ["text"],
		card: "https://www.prompthub.us/models/claude-3-opus",
		contextWindow: 200000,
		maxTokens: 4096,
		costPer1kInputTokens: 0.015,
		costPer1kOutputTokens: 0.075,
		strengths: ["chat", "analysis", "reasoning", "creative"],
		contextComplexity: 5,
		reliability: 5,
		speed: 3,
		multimodal: true,
		isFeatured: true,
		includedInRouter: true,
	}),
]);
