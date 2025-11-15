import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "upstage";

export const upstageModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("solar-mini", PROVIDER, {
		name: "solar-mini",
		matchingModel: "solar-mini",
		description: "Lightweight Upstage model for efficient text tasks.",
		knowledgeCutoffDate: "September 2024",
		releaseDate: "June 12, 2024",
		lastUpdated: "April 22, 2025",
		modalities: { input: ["text"], output: ["text"] },
		supportsAttachments: false,
		supportsTemperature: true,
		reasoningConfig: { enabled: false },
		supportsToolCalls: true,
		contextWindow: 32768,
		maxTokens: 4096,
		costPer1kInputTokens: 0.00015,
		costPer1kOutputTokens: 0.00015,
		strengths: ["chat", "general_knowledge", "analysis"],
		contextComplexity: 3,
		reliability: 3,
		speed: 5,
		includedInRouter: true,
		supportsArtifacts: true,
	}),

	createModelConfig("solar-pro2", PROVIDER, {
		name: "solar-pro2",
		matchingModel: "solar-pro2",
		description: "Upstage Solar Pro 2 with reasoning support.",
		knowledgeCutoffDate: "March 2025",
		releaseDate: "May 20, 2025",
		lastUpdated: "May 20, 2025",
		modalities: { input: ["text"], output: ["text"] },
		supportsAttachments: false,
		supportsTemperature: true,
		reasoningConfig: { enabled: true },
		supportsToolCalls: true,
		contextWindow: 65536,
		maxTokens: 8192,
		costPer1kInputTokens: 0.00025,
		costPer1kOutputTokens: 0.00025,
		strengths: ["reasoning", "analysis", "coding", "general_knowledge"],
		contextComplexity: 4,
		reliability: 4,
		speed: 4,
		includedInRouter: true,
		supportsArtifacts: true,
		isFeatured: true,
	}),
]);
