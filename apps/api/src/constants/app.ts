export const APP_NAME = "Polychat";
export const APP_DESCRIPTION =
  "Polychat is a multi-model AI assistant platform that orchestrates chats, agents, retrieval, and artifact workflows across leading AI providers.";

export const LOCAL_HOST = "localhost:5173";
export const PROD_HOST = "polychat.app";

export const METRICS_LOCAL_HOST = "localhost:9090";
export const METRICS_PROD_HOST = "metrics.polychat.app";

export const API_LOCAL_HOST = "localhost:8787";
export const API_PROD_HOST = "api.polychat.app";

export const gatewayId = "llm-assistant";

const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 200;

const MULTIPLIER_BASELINE_MODEL = "claude-sonnet-5";
const MULTIPLIER_BASELINE_INPUT_COST_PER_1K = 0.002;
const MULTIPLIER_BASELINE_OUTPUT_COST_PER_1K = 0.01;

export const USAGE_CONFIG = {
  NON_AUTH_DAILY_MESSAGE_LIMIT,
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  MULTIPLIER_BASELINE_MODEL,
  MULTIPLIER_BASELINE_INPUT_COST_PER_1K,
  MULTIPLIER_BASELINE_OUTPUT_COST_PER_1K,
};

export const FREE_TRIAL_DAYS = 90;

export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const MAGIC_LINK_EXPIRATION_MINUTES = 15;

export const MAX_CONTENT_LENGTH = 1000000; // 1MB
export const MAX_THINKING_LENGTH = 500000; // 500KB
export const MAX_PROVIDER_STREAM_EVENT_LENGTH = 20 * 1024 * 1024; // 20MB

export const SANDBOX_RUNS_APP_ID = "sandbox_runs";
export const SANDBOX_RUN_ITEM_TYPE = "sandbox_run";
export const MAX_STORED_STREAM_EVENTS = 500;
