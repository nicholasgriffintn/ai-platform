export const gatewayId = "llm-assistant";

export const ROUTES = {
  WEBHOOKS: "/webhooks",
  CHAT: "/chat",
  APPS: "/apps",
  AUTH: "/auth",
  MODELS: "/models",
  AUDIO: "/audio",
  DYNAMIC_APPS: "/dynamic-apps",
  SEARCH: "/search",
  TOOLS: "/tools",
  UPLOADS: "/uploads",
  USER: "/user",
} as const;

const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 200;

const BASELINE_INPUT_COST = 0.0025;
const BASELINE_OUTPUT_COST = 0.01;

export const USAGE_CONFIG = {
  NON_AUTH_DAILY_MESSAGE_LIMIT,
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  BASELINE_INPUT_COST,
  BASELINE_OUTPUT_COST,
};
