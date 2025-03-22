import type { ModelConfig } from "../../types";

// TODO: Huggingface models have a whole range of parameters, how do we handle this?
export const huggingfaceModelConfig: ModelConfig = {
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
		name: "DeepSeek R1 Distill Qwen 1.5B",
		matchingModel: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
		provider: "huggingface",
		type: ["text"],
		isFree: false,
	},
	"NousResearch/Hermes-3-Llama-3.1-8B": {
		name: "NousResearch Hermes 3 Llama 3.1 8B",
		matchingModel: "NousResearch/Hermes-3-Llama-3.1-8B",
		provider: "huggingface",
		type: ["text"],
		isFree: false,
	},
};
