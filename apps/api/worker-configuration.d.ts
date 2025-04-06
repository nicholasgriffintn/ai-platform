import type {
  Ai,
  AnalyticsEngineDataset,
  D1Database,
  R2Bucket,
  RateLimit,
  VectorizeIndex,
} from "@cloudflare/workers-types";

interface Env {
  EMBEDDING_PROVIDER: "bedrock";
  ACCESS_TOKEN: string;
  OPENWEATHERMAP_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GROK_API_KEY: string;
  HUGGINGFACE_TOKEN: string;
  PERPLEXITY_API_KEY: string;
  REPLICATE_API_TOKEN: string;
  WEBHOOK_SECRET: string;
  ASSETS_BUCKET_ACCESS_KEY_ID: string;
  ASSETS_BUCKET_SECRET_ACCESS_KEY: string;
  MISTRAL_API_KEY: string;
  OPENROUTER_API_KEY: string;
  AI_GATEWAY_TOKEN: string;
  BEDROCK_AWS_ACCESS_KEY: string;
  BEDROCK_AWS_SECRET_KEY: string;
  ACCOUNT_ID: string;
  BEDROCK_GUARDRAIL_ID: string;
  BEDROCK_GUARDRAIL_VERSION: string;
  GUARDRAILS_ENABLED: string;
  GUARDRAILS_PROVIDER: string;
  OPENAI_API_KEY: string;
  GOOGLE_STUDIO_API_KEY: string;
  BEDROCK_KNOWLEDGE_BASE_ID: string;
  BEDROCK_KNOWLEDGE_BASE_CUSTOM_DATA_SOURCE_ID: string;
  ELEVENLABS_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  GROQ_API_KEY: string;
  ANALYTICS_API_KEY: string;
  LOG_LEVEL?: string;
  ASSETS_BUCKET: R2Bucket;
  DB: D1Database;
  ANALYTICS: AnalyticsEngineDataset;
  RATE_LIMITER: RateLimit;
  VECTOR_DB: VectorizeIndex;
  AI: Ai;
}
