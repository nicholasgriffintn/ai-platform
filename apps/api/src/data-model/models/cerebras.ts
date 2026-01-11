import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "cerebras";

export const cerebrasModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("cerebras/llama3.1-8b", PROVIDER, {
		name: "Cerebras Llama 3.1 8B",
		matchingModel: "llama3.1-8b",
		description:
			"A high speed deployment of Llama 3.1 8B optimized for chat and reasoning tasks.",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/llama-3.3-70b", PROVIDER, {
		name: "Cerebras Llama 3.3 70B",
		matchingModel: "llama-3.3-70b",
		description:
			"A high speed deployment of Llama 3.3. 70b optimized for chat and reasoning tasks.",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/gpt-oss-120b", PROVIDER, {
		name: "Cerebras GPT OSS 120b",
		matchingModel: "gpt-oss-120b",
		description: "",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/qwen-3-32b", PROVIDER, {
		name: "Cerebras Qwen 3 32B",
		matchingModel: "qwen-3-32b",
		description: "",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/zai-glm-4.6", PROVIDER, {
		name: "Cerebras ZAI GLM 4.6",
		matchingModel: "zai-glm-4.6",
		description:
			"This model delivers strong coding performance with advanced reasoning capabilities, superior tool use, and enhanced real-world performance in agentic coding applications.",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/zai-glm-4.7", PROVIDER, {
		name: "Cerebras ZAI GLM 4.7",
		matchingModel: "zai-glm-4.7",
		description:
			"This model delivers strong coding performance with advanced reasoning capabilities, superior tool use, and enhanced real-world performance in agentic coding applications.",
		modalities: { input: ["text"], output: ["text"] },
	}),
]);
