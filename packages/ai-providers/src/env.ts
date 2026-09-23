import type { Ai, AnalyticsEngineDataset, D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface ProviderEnv {
  AI?: Ai;
  ANALYTICS?: AnalyticsEngineDataset;
  DB?: D1Database;
  PRIVATE_ASSETS_BUCKET?: R2Bucket;
  ACCOUNT_ID?: string;
  API_BASE_URL?: string;
  AI_GATEWAY_TOKEN?: string;
  AWS_REGION?: string;
  AZURE_API_VERSION?: string;
  AZURE_RESOURCE_NAME?: string;
  BEDROCK_AWS_ACCESS_KEY?: string;
  BEDROCK_AWS_SECRET_KEY?: string;
  BEDROCK_AWS_REGION?: string;
  BEDROCK_MANTLE_AWS_REGION?: string;
  DASHSCOPE_BASE_URL?: string;
  EMBEDDINGS_OUTPUT_BUCKET?: string;
  EMBEDDINGS_OUTPUT_BUCKET_OWNER?: string;
  EXA_API_KEY?: string;
  GREENPT_API_KEY?: string;
  PARALLEL_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  SAGEMAKER_AWS_ACCESS_KEY?: string;
  SAGEMAKER_AWS_SECRET_KEY?: string;
  SAGEMAKER_AWS_SESSION_TOKEN?: string;
  SAGEMAKER_AWS_REGION?: string;
  SERPER_API_KEY?: string;
  SHIELDSTRAL_API_KEY?: string;
  SHIELDSTRAL_BASE_URL?: string;
  SHIELDSTRAL_MODEL?: string;
  SHIELDSTRAL_POLICY?: string;
  SHIELDSTRAL_POLICY_VERSION?: string;
  SHIELDSTRAL_THRESHOLD?: string;
  TAVILY_API_KEY?: string;
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  [key: string]: unknown;
}

export interface ProviderUser {
  id: number;
  email?: string | null;
  plan_id?: string | null;
}

export interface ProviderRequestContext {
  env?: ProviderEnv;
  user?: ProviderUser;
  anonymousUser?: { id: string } | null;
  experimentAssignments?: Readonly<Record<string, string>>;
}
