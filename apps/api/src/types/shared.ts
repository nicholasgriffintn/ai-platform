import type {
  Ai,
  AnalyticsEngineDataset,
  D1Database,
  KVNamespace,
  Queue,
  Vectorize,
  SendEmail,
} from "@cloudflare/workers-types";
import type { ReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import type { MCPClientManagerOptions } from "agents/mcp/client";

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type CredentialAuthority = "byok" | "platform";

type WorkerCacheFetcher<Props> = {
  fetch(input: RequestInfo | URL, init?: RequestInit & { props?: Props }): Promise<Response>;
};

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
  PRIVATE_ASSETS_BUCKET: any;
  ACCOUNT_ID: string;
  APP_BASE_URL?: string;
  API_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  AI_GATEWAY_TOKEN?: string;
  SANDBOX_WORKER?: Fetcher;
  TRAINING_WORKER?: WorkerCacheFetcher<{ userId: string }>;
  TRAINING_WORKER_TOKEN?: string;
  SANDBOX_RUN_COORDINATOR?: DurableObjectNamespace;
  CONVERSATION_COORDINATOR?: DurableObjectNamespace;
  GROK_API_KEY?: string;
  HUGGINGFACE_TOKEN?: string;
  REPLICATE_API_TOKEN?: string;
  ASSETS_BUCKET_ACCESS_KEY_ID: string;
  ASSETS_BUCKET_SECRET_ACCESS_KEY: string;
  MISTRAL_API_KEY?: string;
  SHIELDSTRAL_BASE_URL?: string;
  SHIELDSTRAL_API_KEY?: string;
  SHIELDSTRAL_MODEL?: string;
  SHIELDSTRAL_POLICY?: string;
  SHIELDSTRAL_POLICY_VERSION?: string;
  SHIELDSTRAL_THRESHOLD?: string;
  OPENROUTER_API_KEY?: string;
  FAL_KEY?: string;
  IDEOGRAM_API_KEY?: string;
  PARALLEL_API_KEY?: string;
  EXA_API_KEY?: string;
  PASHI_API_KEY?: string;
  BEDROCK_AWS_ACCESS_KEY?: string;
  BEDROCK_AWS_SECRET_KEY?: string;
  BEDROCK_AWS_REGION?: string;
  SAGEMAKER_AWS_ACCESS_KEY?: string;
  SAGEMAKER_AWS_SECRET_KEY?: string;
  SAGEMAKER_AWS_SESSION_TOKEN?: string;
  SAGEMAKER_AWS_REGION?: string;
  SAGEMAKER_ROLE_ARN?: string;
  SAGEMAKER_BUCKET?: string;
  SAGEMAKER_VOLUME_SIZE_GB?: string;
  S3VECTORS_AWS_ACCESS_KEY?: string;
  S3VECTORS_AWS_SECRET_KEY?: string;
  AWS_REGION?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_STUDIO_API_KEY?: string;
  GROQ_API_KEY?: string;
  ANALYTICS_API_KEY?: string;
  ARTIFICIAL_ANALYSIS_API_KEY?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
  POSTHOG_BACKEND_ENABLED?: string;
  POSTHOG_AI_OBSERVABILITY_ENABLED?: string;
  POSTHOG_CAPTURE_AI_CONTENT?: string;
  AI_OBSERVABILITY_ENABLED?: string;
  BEACON_BACKEND_ENABLED?: string;
  BEACON_ENDPOINT?: string;
  BEACON_SITE_ID?: string;
  OLLAMA_ENABLED?: string;
  OLLAMA_URL?: string;
  OLLAMA_CLOUD_API_KEY?: string;
  LMSTUDIO_ENABLED?: string;
  LMSTUDIO_URL?: string;
  LMSTUDIO_API_KEY?: string;
  ZAI_API_KEY?: string;
  MOONSHOT_API_KEY?: string;
  MINIMAX_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  GOOGLE_VERTEX_API_KEY?: string;
  META_MODEL_API_KEY?: string;
  GREENPT_API_KEY?: string;
  LUCIDQUERY_API_KEY?: string;
  OVHCLOUD_API_KEY?: string;
  REGOLO_API_KEY?: string;
  SAKANA_API_KEY?: string;
  STANDARDCOMPUTE_API_KEY?: string;
  THEGRID_API_KEY?: string;
  KIMI_API_KEY?: string;
  TINKER_API_KEY?: string;
  GITHUB_MODELS_API_TOKEN?: string;
  MCP_STORAGE?: MCPClientManagerOptions["storage"];
  POLLY_ACCESS_KEY_ID?: string;
  POLLY_SECRET_ACCESS_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  TAVILY_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  BROWSER_RENDERING_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  APPLE_IOS_CLIENT_ID?: string;
  APPLE_WEB_CLIENT_ID?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_WEBHOOK_SECRET?: string;
  GITHUB_APP_INSTALL_URL?: string;
  GITHUB_APP_SLUG?: string;
  COMPOSIO_API_KEY?: string;
  COMPOSIO_USER_NAMESPACE?: string;
  COMPOSIO_WEBHOOK_SECRET?: string;
  SANDBOX_DEFAULT_TIMEOUT_SECONDS?: string;
  SANDBOX_MAX_TIMEOUT_SECONDS?: string;
  SANDBOX_MAX_CONCURRENT_RUNS?: string;
  SANDBOX_MAX_RUNS_PER_DAY?: string;
  SANDBOX_MAX_RUN_STARTS_PER_MINUTE?: string;
  SANDBOX_ALLOWED_MODELS?: string;
  SANDBOX_BLOCKED_MODELS?: string;
  JWT_SECRET?: string;
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
  SENTRY_DSN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SES_EMAIL_FROM?: string;
  HCAPTCHA_SECRET_KEY?: string;
  HCAPTCHA_SITE_KEY?: string;
  FREE_RATE_LIMITER?: unknown;
  PRO_RATE_LIMITER?: unknown;
  ENV?: string;
  EMBEDDINGS_OUTPUT_BUCKET_OWNER?: string;
  EMBEDDINGS_OUTPUT_BUCKET?: string;
  SEND_EMAIL?: SendEmail;
};

export type ReasoningEffortLevel = ReasoningEffort;
export type VerbosityLevel = "low" | "medium" | "high" | "caveman";
