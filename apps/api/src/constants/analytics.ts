export const POSTHOG_DEFAULT_HOST = "https://eu.i.posthog.com";
export const BEACON_DEFAULT_ENDPOINT = "https://beacon.polychat.app";

export const BACKEND_ANALYTICS_APP_NAME = "polychat-api";
export const BACKEND_ANALYTICS_APP_TYPE = "worker";

export const AI_GENERATION_EVENT_NAME = "$ai_generation";
export const AI_OBSERVABILITY_EVENT_CATEGORY = "ai_observability";
export const AI_INPUT_TOKEN_USAGE_FIELDS = [
	"prompt_tokens",
	"input_tokens",
	"promptTokenCount",
	"inputTokens",
] as const;
export const AI_OUTPUT_TOKEN_USAGE_FIELDS = [
	"completion_tokens",
	"output_tokens",
	"candidatesTokenCount",
	"outputTokens",
] as const;
export const AI_TOTAL_TOKEN_USAGE_FIELDS = ["total_tokens", "totalTokens"] as const;
