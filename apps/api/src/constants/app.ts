export const APP_NAME = "Polychat";
export const APP_DESCRIPTION =
	"Polychat is a multi-model AI assistant platform that orchestrates chats, agents, retrieval, and artifact workflows across leading AI providers.";

export const LOCAL_HOST = "localhost:5173";
export const PROD_HOST = "polychat.app";

export const API_LOCAL_HOST = "localhost:8787";
export const API_PROD_HOST = "api.polychat.app";

export const gatewayId = "llm-assistant";

export const ROUTES = {
	CHAT: "/chat",
	APPS: "/apps",
	AUTH: "/auth",
	MODELS: "/models",
	AUDIO: "/audio",
	DYNAMIC_APPS: "/dynamic-apps",
	SEARCH: "/search",
	TASKS: "/tasks",
	TOOLS: "/tools",
	UPLOADS: "/uploads",
	USER: "/user",
	PLANS: "/plans",
	STRIPE: "/stripe",
	REALTIME: "/realtime",
	AGENTS: "/agents",
	ADMIN: "/admin",
	MEMORIES: "/memories",
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

export const FREE_TRIAL_DAYS = 90;

export const MAGIC_LINK_EXPIRATION_MINUTES = 15;

export const MAX_CONTENT_LENGTH = 1000000; // 1MB
export const MAX_THINKING_LENGTH = 500000; // 500KB
export const MAX_BUFFER_LENGTH = 100000; // 100KB
