export const API_URL_DEFAULT = "https://models.dev/api.json";

export const POLYCHAT_API_BASE_URL_DEFAULT = "https://api.polychat.app";

export const PROVIDER_ALIASES = {
	"azure-openai": "azure",
	bedrock: "amazon-bedrock",
	"workers-ai": "cloudflare-workers-ai",
	"together-ai": "togetherai",
	"google-ai-studio": "google",
	fireworks: "fireworks-ai",
	ollama: "ollama-cloud",
	grok: "xai",
	"perplexity-ai": "perplexity",
};

export const LATEST_TAGS = new Set(["latest", "current"]);

export const OUTDATED_TAGS = new Set(["deprecated", "legacy", "retired", "obsolete", "outdated"]);

export const VERSION_SUFFIX_REGEX = /^(.*?)[-_:]((?:19|20)\d{2}(?:[-_]?\d{2}){1,2}|v?\d{4,})$/i;

export const CURRENT_ALIAS_SUFFIX_REGEX = /^(.*?)[-_:](0|latest)$/i;

export const IGNORED_REMOTE_MODEL_IDS = {
	mistral: new Set(["mistral-nemo"]),
};

export const SUPPORTED_MODALITIES = new Set([
	"text",
	"image",
	"audio",
	"video",
	"pdf",
	"document",
	"embedding",
	"moderation",
	"speech",
	"voice-activity-detection",
	"guardrails",
	"reranking",
	"search",
	"creative",
	"instruction",
	"summarization",
	"multilingual",
	"general_knowledge",
	"coding",
	"reasoning",
	"vision",
	"chat",
	"math",
	"analysis",
	"tool_use",
	"academic",
	"research",
	"agents",
	"ocr",
	"transcription",
]);

export const UPDATE_FIELD_ORDER = [
	"name",
	"matchingModel",
	"provider",
	"family",
	"status",
	"openWeights",
	"knowledgeCutoffDate",
	"releaseDate",
	"lastUpdated",
	"modalities",
	"supportsAttachments",
	"supportsTemperature",
	"supportsToolCalls",
	"supportsToolChoice",
	"supportsResponseFormat",
	"contextWindow",
	"maxTokens",
	"costPer1kInputTokens",
	"costPer1kOutputTokens",
	"costPer1kReasoningTokens",
	"strengths",
	"contextComplexity",
	"reliability",
	"speed",
	"isFree",
	"reasoningConfig",
	"artificialAnalysis",
];

export const UNPARSEABLE = Symbol("unparseable");
