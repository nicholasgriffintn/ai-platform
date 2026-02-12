import type { ModelConfig } from "~/types";

export const ollamaModelConfig: ModelConfig = {
	"ollama-gemma3-1b": {
		name: "Ollama Gemma 3 1B",
		matchingModel: "gemma3:1b",
		provider: "ollama",
		strengths: ["summarization"],
		contextWindow: 32000,
		modalities: {
			input: ["text"],
			output: ["text"],
		},
	},
	"ollama-gemma3-4b": {
		name: "gemma3:4b",
		matchingModel: "gemma3:4b",
		provider: "ollama",
		multimodal: true,
		strengths: ["summarization", "multilingual", "creative"],
		contextWindow: 131072,
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		releaseDate: "December 1, 2024",
		lastUpdated: "January 19, 2026",
		supportsAttachments: true,
		supportsToolCalls: false,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: false,
		},
	},
	"ollama-gemma3-12b": {
		name: "gemma3:12b",
		matchingModel: "gemma3:12b",
		provider: "ollama",
		multimodal: true,
		strengths: ["summarization", "multilingual", "creative"],
		contextWindow: 131072,
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		releaseDate: "December 1, 2024",
		lastUpdated: "January 19, 2026",
		supportsAttachments: true,
		supportsToolCalls: false,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: false,
		},
	},
	"ollama-gemma3-27b": {
		name: "gemma3:27b",
		matchingModel: "gemma3:27b",
		provider: "ollama",
		multimodal: true,
		strengths: ["summarization", "multilingual", "creative"],
		contextWindow: 131072,
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		releaseDate: "July 27, 2025",
		lastUpdated: "January 19, 2026",
		supportsAttachments: true,
		supportsToolCalls: false,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: false,
		},
	},
	"cogito-2.1:671b": {
		name: "cogito-2.1:671b",
		matchingModel: "cogito-2.1:671b",
		provider: "ollama",
		releaseDate: "November 19, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 163840,
		maxTokens: 32000,
		reasoningConfig: {
			enabled: true,
		},
	},

	"deepseek-v3.1:671b": {
		name: "deepseek-v3.1:671b",
		matchingModel: "deepseek-v3.1:671b",
		provider: "ollama",
		releaseDate: "August 21, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 163840,
		maxTokens: 163840,
		reasoningConfig: {
			enabled: true,
		},
	},

	"deepseek-v3.2": {
		name: "deepseek-v3.2",
		matchingModel: "deepseek-v3.2",
		provider: "ollama",
		releaseDate: "June 15, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 163840,
		maxTokens: 65536,
		reasoningConfig: {
			enabled: true,
		},
	},

	"devstral-2:123b": {
		name: "devstral-2:123b",
		matchingModel: "devstral-2:123b",
		provider: "ollama",
		releaseDate: "December 9, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: false,
		},
	},

	"devstral-small-2:24b": {
		name: "devstral-small-2:24b",
		matchingModel: "devstral-small-2:24b",
		provider: "ollama",
		releaseDate: "December 9, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: false,
		},
	},

	"gemini-3-flash-preview": {
		name: "gemini-3-flash-preview",
		matchingModel: "gemini-3-flash-preview",
		provider: "ollama",
		knowledgeCutoffDate: "January 2025",
		releaseDate: "December 17, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 1048576,
		maxTokens: 65536,
		reasoningConfig: {
			enabled: true,
		},
	},

	"gemini-3-pro-preview": {
		name: "gemini-3-pro-preview",
		matchingModel: "gemini-3-pro-preview",
		provider: "ollama",
		releaseDate: "November 18, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 1048576,
		maxTokens: 64000,
		reasoningConfig: {
			enabled: true,
		},
	},

	"glm-4.6": {
		name: "glm-4.6",
		matchingModel: "glm-4.6",
		provider: "ollama",
		releaseDate: "September 29, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 202752,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: true,
		},
	},

	"glm-4.7": {
		name: "glm-4.7",
		matchingModel: "glm-4.7",
		provider: "ollama",
		releaseDate: "December 22, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 202752,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: true,
		},
	},

	"glm-5": {
		name: "glm-5",
		matchingModel: "glm-5",
		provider: "ollama",
		releaseDate: "February 11, 2026",
		lastUpdated: "February 11, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 202752,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: true,
		},
	},

	"gpt-oss:120b": {
		name: "gpt-oss:120b",
		matchingModel: "gpt-oss:120b",
		provider: "ollama",
		releaseDate: "August 5, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 131072,
		maxTokens: 32768,
		reasoningConfig: {
			enabled: true,
		},
	},

	"gpt-oss:20b": {
		name: "gpt-oss:20b",
		matchingModel: "gpt-oss:20b",
		provider: "ollama",
		releaseDate: "August 5, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 131072,
		maxTokens: 32768,
		reasoningConfig: {
			enabled: true,
		},
	},

	"kimi-k2-thinking": {
		name: "kimi-k2-thinking",
		matchingModel: "kimi-k2-thinking",
		provider: "ollama",
		knowledgeCutoffDate: "August 2024",
		releaseDate: "November 6, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: true,
		},
	},

	"kimi-k2:1t": {
		name: "kimi-k2:1t",
		matchingModel: "kimi-k2:1t",
		provider: "ollama",
		knowledgeCutoffDate: "October 2024",
		releaseDate: "July 11, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: false,
		},
	},

	"kimi-k2.5": {
		name: "kimi-k2.5",
		matchingModel: "kimi-k2.5",
		provider: "ollama",
		releaseDate: "January 27, 2026",
		lastUpdated: "January 27, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: true,
		},
	},

	"minimax-m2": {
		name: "minimax-m2",
		matchingModel: "minimax-m2",
		provider: "ollama",
		releaseDate: "October 23, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 204800,
		maxTokens: 128000,
		reasoningConfig: {
			enabled: false,
		},
	},

	"minimax-m2.1": {
		name: "minimax-m2.1",
		matchingModel: "minimax-m2.1",
		provider: "ollama",
		releaseDate: "December 23, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 204800,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: true,
		},
	},

	"ministral-3:14b": {
		name: "ministral-3:14b",
		matchingModel: "ministral-3:14b",
		provider: "ollama",
		releaseDate: "December 1, 2024",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 128000,
		reasoningConfig: {
			enabled: false,
		},
	},

	"ministral-3:3b": {
		name: "ministral-3:3b",
		matchingModel: "ministral-3:3b",
		provider: "ollama",
		releaseDate: "October 22, 2024",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 128000,
		reasoningConfig: {
			enabled: false,
		},
	},

	"ministral-3:8b": {
		name: "ministral-3:8b",
		matchingModel: "ministral-3:8b",
		provider: "ollama",
		releaseDate: "December 1, 2024",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 128000,
		reasoningConfig: {
			enabled: false,
		},
	},

	"mistral-large-3:675b": {
		name: "mistral-large-3:675b",
		matchingModel: "mistral-large-3:675b",
		provider: "ollama",
		releaseDate: "December 2, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 262144,
		reasoningConfig: {
			enabled: false,
		},
	},

	"nemotron-3-nano:30b": {
		name: "nemotron-3-nano:30b",
		matchingModel: "nemotron-3-nano:30b",
		provider: "ollama",
		releaseDate: "December 15, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 1048576,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: true,
		},
	},

	"qwen3-coder-next": {
		name: "qwen3-coder-next",
		matchingModel: "qwen3-coder-next",
		provider: "ollama",
		releaseDate: "February 2, 2026",
		lastUpdated: "February 8, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 65536,
		reasoningConfig: {
			enabled: false,
		},
	},

	"qwen3-coder:480b": {
		name: "qwen3-coder:480b",
		matchingModel: "qwen3-coder:480b",
		provider: "ollama",
		releaseDate: "July 22, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 65536,
		reasoningConfig: {
			enabled: false,
		},
	},

	"qwen3-next:80b": {
		name: "qwen3-next:80b",
		matchingModel: "qwen3-next:80b",
		provider: "ollama",
		releaseDate: "September 15, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 32768,
		reasoningConfig: {
			enabled: true,
		},
	},

	"qwen3-vl:235b": {
		name: "qwen3-vl:235b",
		matchingModel: "qwen3-vl:235b",
		provider: "ollama",
		releaseDate: "September 22, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 32768,
		reasoningConfig: {
			enabled: true,
		},
	},

	"qwen3-vl:235b-instruct": {
		name: "qwen3-vl:235b-instruct",
		matchingModel: "qwen3-vl:235b-instruct",
		provider: "ollama",
		releaseDate: "September 22, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text", "image"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsToolCalls: true,
		contextWindow: 262144,
		maxTokens: 131072,
		reasoningConfig: {
			enabled: false,
		},
	},

	"rnj-1:8b": {
		name: "rnj-1:8b",
		matchingModel: "rnj-1:8b",
		provider: "ollama",
		releaseDate: "December 6, 2025",
		lastUpdated: "January 19, 2026",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsToolCalls: true,
		contextWindow: 32768,
		maxTokens: 4096,
		reasoningConfig: {
			enabled: false,
		},
	},
};
