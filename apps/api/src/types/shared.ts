export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
	T,
	Exclude<keyof T, Keys>
> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

export interface IEnv {
	ANALYTICS: AnalyticsEngineDataset;
	AI: Ai;
	VECTOR_DB: Vectorize;
	DB: D1Database;
	ASSETS_BUCKET: any;
	ACCOUNT_ID: string;
	ANTHROPIC_API_KEY?: string;
	AI_GATEWAY_TOKEN?: string;
	GROK_API_KEY?: string;
	HUGGINGFACE_TOKEN?: string;
	PERPLEXITY_API_KEY?: string;
	CHAT_HISTORY?: any;
	REPLICATE_API_TOKEN?: string;
	WEBHOOK_SECRET?: string;
	ASSETS_BUCKET_ACCESS_KEY_ID: string;
	ASSETS_BUCKET_SECRET_ACCESS_KEY: string;
	MISTRAL_API_KEY?: string;
	OPENROUTER_API_KEY?: string;
	BEDROCK_AWS_ACCESS_KEY?: string;
	BEDROCK_AWS_SECRET_KEY?: string;
	BEDROCK_GUARDRAIL_ID: string;
	BEDROCK_GUARDRAIL_VERSION?: string;
	AWS_REGION?: string;
	GUARDRAILS_ENABLED?: string;
	GUARDRAILS_PROVIDER?: string;
	OPENAI_API_KEY?: string;
	GOOGLE_STUDIO_API_KEY?: string;
	EMBEDDING_PROVIDER?: string;
	BEDROCK_KNOWLEDGE_BASE_ID?: string;
	BEDROCK_KNOWLEDGE_BASE_CUSTOM_DATA_SOURCE_ID?: string;
	GROQ_API_KEY?: string;
	ANALYTICS_API_KEY?: string;
	OLLAMA_ENABLED?: string;
	OLLAMA_URL?: string;
	GITHUB_MODELS_API_TOKEN?: string;
	POLLY_ACCESS_KEY_ID?: string;
	POLLY_SECRET_ACCESS_KEY?: string;
	DEEPSEEK_API_KEY?: string;
	TAVILY_API_KEY?: string;
	BROWSER_RENDERING_API_KEY?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	ACCESS_TOKEN?: string;
	JWT_SECRET?: string;
	AUTH_REDIRECT_URL?: string;
	ALLOWED_USERNAMES?: string;
}
