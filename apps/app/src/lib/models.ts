import type { ChatMode, ModelConfig, ModelConfigItem } from "~/types";

export const defaultModel = "mistral-medium";

export const webLLMModels: ModelConfig = {
	"Llama-3.2-1B-Instruct-q4f32_1-MLC": {
		id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
		matchingModel: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
		name: "Llama 3.2 1B Instruct (Q4F32)",
		description: "Quantized Llama 3.2 1B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Llama-3.2-3B-Instruct-q4f32_1-MLC": {
		id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
		matchingModel: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
		name: "Llama 3.2 3B Instruct (Q4F32)",
		description: "Quantized Llama 3.2 3B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Llama-3.1-8B-Instruct-q4f32_1-MLC": {
		id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
		matchingModel: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
		name: "Llama 3.1 8B Instruct (Q4F32)",
		description: "Quantized Llama 3.1 8B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Mistral-7B-Instruct-v0.3-q4f16_1-MLC": {
		id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
		matchingModel: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
		name: "Mistral 7B Instruct v0.3 (Q4F16)",
		description: "Latest Mistral 7B v0.3 model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"gemma-2-2b-it-q4f32_1-MLC": {
		id: "gemma-2-2b-it-q4f32_1-MLC",
		matchingModel: "gemma-2-2b-it-q4f32_1-MLC",
		name: "Gemma 2 2B IT (Q4F32)",
		description: "Google's Gemma 2B instruction-tuned model",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"gemma-2-9b-it-q4f32_1-MLC": {
		id: "gemma-2-9b-it-q4f32_1-MLC",
		matchingModel: "gemma-2-9b-it-q4f32_1-MLC",
		name: "Gemma 2 9B IT (Q4F32)",
		description: "Google's Gemma 9B instruction-tuned model",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"SmolLM2-1.7B-Instruct-q4f16_1-MLC": {
		id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
		matchingModel: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
		name: "SmolLM2 1.7B Instruct (Q4F16)",
		description: "Efficient small language model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Phi-3.5-mini-instruct-q4f32_1-MLC": {
		id: "Phi-3.5-mini-instruct-q4f32_1-MLC",
		matchingModel: "Phi-3.5-mini-instruct-q4f32_1-MLC",
		name: "Phi 3.5 Mini Instruct (Q4F32)",
		description: "Microsoft's Phi 3.5 Mini model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Phi-3.5-vision-instruct-q4f32_1-MLC": {
		id: "Phi-3.5-vision-instruct-q4f32_1-MLC",
		matchingModel: "Phi-3.5-vision-instruct-q4f32_1-MLC",
		name: "Phi 3.5 Vision Instruct (Q4F32)",
		description:
			"Microsoft's Phi 3.5 Vision model with multimodal capabilities",
		strengths: ["text-generation", "image-to-text"],
		provider: "web-llm",
		type: ["text", "image-to-text"],
		isFree: true,
		isFeatured: true,
	},
	"Qwen2.5-1.5B-Instruct-q4f32_1-MLC": {
		id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
		matchingModel: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
		name: "Qwen 2.5 1.5B Instruct (Q4F32)",
		description: "Alibaba's Qwen 2.5 small model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
	},
	"Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC": {
		id: "Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC",
		matchingModel: "Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC",
		name: "Qwen 2.5 Coder 1.5B (Q4F32)",
		description:
			"Alibaba's Qwen 2.5 Coder model optimized for programming tasks",
		strengths: ["text-generation", "code-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Qwen3-0.6B-q4f32_1-MLC": {
		id: "Qwen3-0.6B-q4f32_1-MLC",
		matchingModel: "Qwen3-0.6B-q4f32_1-MLC",
		name: "Qwen 3 0.6B (Q4F32)",
		description: "Alibaba's Qwen 3 0.6B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Qwen3-1.7B-q4f32_1-MLC": {
		id: "Qwen3-1.7B-q4f32_1-MLC",
		matchingModel: "Qwen3-1.7B-q4f32_1-MLC",
		name: "Qwen 3 1.7B (Q4F32)",
		description: "Alibaba's Qwen 3 1.7B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Qwen3-4B-q4f32_1-MLC": {
		id: "Qwen3-4B-q4f32_1-MLC",
		matchingModel: "Qwen3-4B-q4f32_1-MLC",
		name: "Qwen 3 4B (Q4F32)",
		description: "Alibaba's Qwen 3 4B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Qwen3-8B-q4f32_1-MLC": {
		id: "Qwen3-8B-q4f32_1-MLC",
		matchingModel: "Qwen3-8B-q4f32_1-MLC",
		name: "Qwen 3 8B (Q4F32)",
		description: "Alibaba's Qwen 3 8B model optimized for web browsers",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Hermes-3-Llama-3.1-8B-q4f32_1-MLC": {
		id: "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
		matchingModel: "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
		name: "Hermes 3 Llama 3.1 8B (Q4F32)",
		description: "Hermes 3 fine-tuned Llama 3.1 model for enhanced reasoning",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Hermes-3-Llama-3.2-3B-q4f32_1-MLC": {
		id: "Hermes-3-Llama-3.2-3B-q4f32_1-MLC",
		matchingModel: "Hermes-3-Llama-3.2-3B-q4f32_1-MLC",
		name: "Hermes 3 Llama 3.2 3B (Q4F32)",
		description: "Hermes 3 fine-tuned Llama 3.2 model for enhanced reasoning",
		strengths: ["text-generation"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC": {
		id: "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
		matchingModel: "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
		name: "Hermes 2 Pro Llama 3 8B (Q4F32)",
		description:
			"Hermes 2 Pro fine-tuned Llama 3 model with function calling support",
		strengths: ["text-generation", "function-calling"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC": {
		id: "DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC",
		matchingModel: "DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC",
		name: "DeepSeek R1 Distill Qwen 7B (Q4F32)",
		description: "DeepSeek's R1 model with enhanced reasoning capabilities",
		strengths: ["text-generation", "reasoning"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
	"DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC": {
		id: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
		matchingModel: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
		name: "DeepSeek R1 Distill Llama 8B (Q4F32)",
		description: "DeepSeek's R1 model with enhanced reasoning capabilities",
		strengths: ["text-generation", "reasoning"],
		provider: "web-llm",
		type: ["text"],
		isFree: true,
		isFeatured: true,
	},
};

export function getAvailableModels(
	apiModels: ModelConfig,
	shouldIncludeWebLLM = true,
) {
	if (!shouldIncludeWebLLM) {
		return apiModels;
	}
	return { ...webLLMModels, ...apiModels };
}

export function getFeaturedModelIds(models: ModelConfig) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			if (model.isFeatured) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelConfigItem>,
	);
}

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			const hasIncompatibleProvider = model.provider === "ollama";
			const hasIncompatibleType =
				model.type.includes("embedding") ||
				model.type.includes("reranking") ||
				model.type.includes("video-to-video") ||
				model.type.includes("speech") ||
				model.type.includes("text-to-speech");
			const hasIncompatibleTypeAndIsNotText =
				hasIncompatibleType && !model.type.includes("text");
			const isIncompatible =
				hasIncompatibleProvider || hasIncompatibleTypeAndIsNotText;

			if (
				!isIncompatible &&
				(mode === "local"
					? model.provider === "web-llm"
					: model.provider !== "web-llm")
			) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelConfigItem>,
	);
}
