import type {
	Ai,
	AnalyticsEngineDataset,
	D1Database,
	KVNamespace,
	Queue,
	Vectorize,
} from "@cloudflare/workers-types";

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
	T,
	Exclude<keyof T, Keys>
> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

export type IEnv = {
	ANALYTICS: AnalyticsEngineDataset;
	AI: Ai;
	VECTOR_DB: Vectorize;
	DB: D1Database;
	CACHE: KVNamespace;
	TASK_QUEUE?: Queue;
	MEMORY_SYNTHESIS_ENABLED?: string;
	TRAINING_QUALITY_SCORING_ENABLED?: string;
	ASSETS_BUCKET: any;
	ACCOUNT_ID: string;
	ANTHROPIC_API_KEY?: string;
	AI_GATEWAY_TOKEN?: string;
	GROK_API_KEY?: string;
	HUGGINGFACE_TOKEN?: string;
	REPLICATE_API_TOKEN?: string;
	ASSETS_BUCKET_ACCESS_KEY_ID: string;
	ASSETS_BUCKET_SECRET_ACCESS_KEY: string;
	MISTRAL_API_KEY?: string;
	OPENROUTER_API_KEY?: string;
	PARALLEL_API_KEY?: string;
	EXA_API_KEY?: string;
	BEDROCK_AWS_ACCESS_KEY?: string;
	BEDROCK_AWS_SECRET_KEY?: string;
	BEDROCK_AWS_REGION?: string;
	S3VECTORS_AWS_ACCESS_KEY?: string;
	S3VECTORS_AWS_SECRET_KEY?: string;
	AWS_REGION?: string;
	OPENAI_API_KEY?: string;
	GOOGLE_STUDIO_API_KEY?: string;
	GROQ_API_KEY?: string;
	ANALYTICS_API_KEY?: string;
	OLLAMA_ENABLED?: string;
	OLLAMA_URL?: string;
	GITHUB_MODELS_API_TOKEN?: string;
	POLLY_ACCESS_KEY_ID?: string;
	POLLY_SECRET_ACCESS_KEY?: string;
	DEEPSEEK_API_KEY?: string;
	TAVILY_API_KEY?: string;
	PERPLEXITY_API_KEY?: string;
	BROWSER_RENDERING_API_KEY?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	JWT_SECRET?: string;
	EMAIL_JWT_SECRET?: string;
	CARTESIA_API_KEY?: string;
	ELEVENLABS_API_KEY?: string;
	TOGETHER_AI_API_KEY?: string;
	VERCEL_AI_GATEWAY_API_KEY?: string;
	AZURE_API_KEY?: string;
	AZURE_RESOURCE_NAME?: string;
	AZURE_API_VERSION?: string;
	GITHUB_COPILOT_TOKEN?: string;
	UPSTAGE_API_KEY?: string;
	CHUTES_API_KEY?: string;
	PUBLIC_ASSETS_URL?: string;
	PUBLIC_ASSETS_BUCKET?: string;
	SERPER_API_KEY?: string;
	PRIVATE_KEY?: string;
	ALWAYS_ENABLED_PROVIDERS?: string;
	LOG_LEVEL?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;
	AWS_SES_ACCESS_KEY_ID?: string;
	AWS_SES_SECRET_ACCESS_KEY?: string;
	SES_EMAIL_FROM?: string;
	HCAPTCHA_SECRET_KEY?: string;
	HCAPTCHA_SITE_KEY?: string;
	FREE_RATE_LIMITER?: unknown;
	PRO_RATE_LIMITER?: unknown;
	ENV?: string;
	EMBEDDINGS_OUTPUT_BUCKET_OWNER?: string;
	EMBEDDINGS_OUTPUT_BUCKET?: string;
};

export type ReasoningEffortLevel = "none" | "low" | "medium" | "high";
export type VerbosityLevel = "low" | "medium" | "high";
