import type { RecipeConnectorProvider } from "@assistant/schemas";
import type { IEnv } from "~/types";

export type ConnectorAuthType = "oauth2" | "github_app" | "api_key";
export type ConnectorOperationAccess = "read" | "write";

export interface OAuthConnectorConfig {
	authType: "oauth2";
	clientIdEnv: keyof IEnv;
	clientSecretEnv: keyof IEnv;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	scopes: string[];
	scopeSeparator: " " | ",";
	tokenAuth?: "body" | "basic";
	tokenRequestFormat?: "form" | "json";
	tokenExtraFields?: Record<string, string>;
	tokenResponsePath?: "body";
	pkce?: boolean;
	extraAuthorizationParams?: Record<string, string>;
}

export interface GitHubAppConnectorConfig {
	authType: "github_app";
	scopes: string[];
}

export interface ApiKeyConnectorConfig {
	authType: "api_key";
	credentialLabel: string;
	scopes: string[];
}

export interface ConnectorProviderConfig {
	id: RecipeConnectorProvider;
	name: string;
	description: string;
	setupUrl: string;
	auth: OAuthConnectorConfig | GitHubAppConnectorConfig | ApiKeyConnectorConfig;
	operations: readonly ConnectorOperationConfig[];
}

export interface ConnectorOperationConfig {
	id: string;
	access: ConnectorOperationAccess;
}

export const RECIPE_CONNECTOR_APP_ID = "recipe_connector_connection";
export const RECIPE_CONNECTOR_ITEM_TYPE = "oauth_connection";

export const connectorProviders = [
	{
		id: "cloudflare",
		name: "Cloudflare",
		description: "Inspect Cloudflare accounts, zones, Workers, and deployments.",
		setupUrl: "/profile?tab=providers&type=connector&connector=cloudflare",
		operations: [
			{ id: "list_accounts", access: "read" },
			{ id: "list_zones", access: "read" },
			{ id: "list_workers", access: "read" },
			{ id: "list_worker_deployments", access: "read" },
			{ id: "get_worker_deployment", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "API token",
			scopes: ["Account:read", "Zone:read", "Workers Scripts:read"],
		},
	},
	{
		id: "devin",
		name: "Devin",
		description: "Start Devin sessions, check progress, and send follow-up messages.",
		setupUrl: "/profile?tab=providers&type=connector&connector=devin",
		operations: [
			{ id: "list_sessions", access: "read" },
			{ id: "get_session", access: "read" },
			{ id: "create_session", access: "write" },
			{ id: "list_messages", access: "read" },
			{ id: "send_message", access: "write" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Service user API key",
			scopes: ["sessions:read", "sessions:write"],
		},
	},
	{
		id: "gmail",
		name: "Gmail",
		description: "Search messages and create reviewed drafts in Gmail.",
		setupUrl: "/profile?tab=providers&type=connector&connector=gmail",
		operations: [
			{ id: "search_messages", access: "read" },
			{ id: "create_draft", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
			clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenEndpoint: "https://oauth2.googleapis.com/token",
			scopes: [
				"https://www.googleapis.com/auth/gmail.readonly",
				"https://www.googleapis.com/auth/gmail.compose",
			],
			scopeSeparator: " ",
			extraAuthorizationParams: {
				access_type: "offline",
				prompt: "consent",
			},
		},
	},
	{
		id: "calendar",
		name: "Google Calendar",
		description: "Read calendars and create reviewed events in Google Calendar.",
		setupUrl: "/profile?tab=providers&type=connector&connector=calendar",
		operations: [
			{ id: "list_events", access: "read" },
			{ id: "create_event", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
			clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenEndpoint: "https://oauth2.googleapis.com/token",
			scopes: ["https://www.googleapis.com/auth/calendar.events"],
			scopeSeparator: " ",
			extraAuthorizationParams: {
				access_type: "offline",
				prompt: "consent",
			},
		},
	},
	{
		id: "outlook",
		name: "Outlook",
		description: "Search Outlook mail and manage reviewed Outlook calendar events.",
		setupUrl: "/profile?tab=providers&type=connector&connector=outlook",
		operations: [
			{ id: "search_messages", access: "read" },
			{ id: "list_events", access: "read" },
			{ id: "create_draft", access: "write" },
			{ id: "create_calendar_event", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
			clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			scopes: ["offline_access", "User.Read", "Mail.ReadWrite", "Calendars.ReadWrite"],
			scopeSeparator: " ",
		},
	},
	{
		id: "linear",
		name: "Linear",
		description: "Search and create Linear issues for developer workflows.",
		setupUrl: "/profile?tab=providers&type=connector&connector=linear",
		operations: [
			{ id: "search_issues", access: "read" },
			{ id: "create_issue", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "LINEAR_OAUTH_CLIENT_ID",
			clientSecretEnv: "LINEAR_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://linear.app/oauth/authorize",
			tokenEndpoint: "https://api.linear.app/oauth/token",
			scopes: ["read", "write"],
			scopeSeparator: " ",
		},
	},
	{
		id: "oura",
		name: "Oura",
		description: "Read Oura readiness, sleep, and activity data.",
		setupUrl: "/profile?tab=providers&type=connector&connector=oura",
		operations: [
			{ id: "daily_readiness", access: "read" },
			{ id: "daily_sleep", access: "read" },
			{ id: "daily_activity", access: "read" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "OURA_OAUTH_CLIENT_ID",
			clientSecretEnv: "OURA_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://cloud.ouraring.com/oauth/authorize",
			tokenEndpoint: "https://api.ouraring.com/oauth/token",
			scopes: ["email", "personal", "daily"],
			scopeSeparator: " ",
		},
	},
	{
		id: "fitbit",
		name: "Fitbit",
		description: "Read Fitbit profile, activity, sleep, and heart-rate data.",
		setupUrl: "/profile?tab=providers&type=connector&connector=fitbit",
		operations: [
			{ id: "profile", access: "read" },
			{ id: "daily_activity", access: "read" },
			{ id: "sleep_logs", access: "read" },
			{ id: "heart_rate", access: "read" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "FITBIT_OAUTH_CLIENT_ID",
			clientSecretEnv: "FITBIT_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://www.fitbit.com/oauth2/authorize",
			tokenEndpoint: "https://api.fitbit.com/oauth2/token",
			scopes: ["profile", "activity", "sleep", "heartrate"],
			scopeSeparator: " ",
			tokenAuth: "basic",
		},
	},
	{
		id: "webflow",
		name: "Webflow",
		description: "Inspect Webflow sites, CMS collections, and CMS items.",
		setupUrl: "/profile?tab=providers&type=connector&connector=webflow",
		operations: [
			{ id: "list_sites", access: "read" },
			{ id: "list_collections", access: "read" },
			{ id: "list_items", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Data API token",
			scopes: ["sites:read", "cms:read"],
		},
	},
	{
		id: "withings",
		name: "Withings",
		description: "Read Withings profile, device, body metric, activity, and sleep data.",
		setupUrl: "/profile?tab=providers&type=connector&connector=withings",
		operations: [
			{ id: "profile", access: "read" },
			{ id: "devices", access: "read" },
			{ id: "measurements", access: "read" },
			{ id: "activity", access: "read" },
			{ id: "sleep_summary", access: "read" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "WITHINGS_OAUTH_CLIENT_ID",
			clientSecretEnv: "WITHINGS_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://account.withings.com/oauth2_user/authorize2",
			tokenEndpoint: "https://wbsapi.withings.net/v2/oauth2",
			scopes: ["user.info", "user.metrics", "user.activity"],
			scopeSeparator: ",",
			tokenExtraFields: {
				action: "requesttoken",
			},
			tokenResponsePath: "body",
		},
	},
	{
		id: "todoist",
		name: "Todoist",
		description: "List, create, and complete Todoist tasks.",
		setupUrl: "/profile?tab=providers&type=connector&connector=todoist",
		operations: [
			{ id: "list_tasks", access: "read" },
			{ id: "create_task", access: "write" },
			{ id: "complete_task", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "TODOIST_OAUTH_CLIENT_ID",
			clientSecretEnv: "TODOIST_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://app.todoist.com/oauth/authorize",
			tokenEndpoint: "https://api.todoist.com/oauth/access_token",
			scopes: ["data:read_write"],
			scopeSeparator: ",",
		},
	},
	{
		id: "asana",
		name: "Asana",
		description: "List projects and create reviewed tasks in Asana.",
		setupUrl: "/profile?tab=providers&type=connector&connector=asana",
		operations: [
			{ id: "list_projects", access: "read" },
			{ id: "list_tasks", access: "read" },
			{ id: "create_task", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "ASANA_OAUTH_CLIENT_ID",
			clientSecretEnv: "ASANA_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://app.asana.com/-/oauth_authorize",
			tokenEndpoint: "https://app.asana.com/-/oauth_token",
			scopes: ["tasks:read", "tasks:write", "projects:read"],
			scopeSeparator: " ",
		},
	},
	{
		id: "sentry",
		name: "Sentry",
		description: "Review Sentry organizations, projects, and issues.",
		setupUrl: "/profile?tab=providers&type=connector&connector=sentry",
		operations: [
			{ id: "list_organizations", access: "read" },
			{ id: "list_projects", access: "read" },
			{ id: "list_issues", access: "read" },
			{ id: "retrieve_issue", access: "read" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "SENTRY_OAUTH_CLIENT_ID",
			clientSecretEnv: "SENTRY_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://sentry.io/oauth/authorize/",
			tokenEndpoint: "https://sentry.io/oauth/token/",
			scopes: ["org:read", "project:read", "event:read"],
			scopeSeparator: " ",
			pkce: true,
		},
	},
	{
		id: "posthog",
		name: "PostHog",
		description: "Query PostHog projects and product analytics.",
		setupUrl: "/profile?tab=providers&type=connector&connector=posthog",
		operations: [
			{ id: "list_projects", access: "read" },
			{ id: "query", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Personal API key",
			scopes: ["project:read", "query:read"],
		},
	},
	{
		id: "ramp",
		name: "Ramp",
		description: "Review Ramp transactions, reimbursements, and bills.",
		setupUrl: "/profile?tab=providers&type=connector&connector=ramp",
		operations: [
			{ id: "list_transactions", access: "read" },
			{ id: "get_transaction", access: "read" },
			{ id: "list_reimbursements", access: "read" },
			{ id: "get_reimbursement", access: "read" },
			{ id: "list_bills", access: "read" },
			{ id: "get_bill", access: "read" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "RAMP_OAUTH_CLIENT_ID",
			clientSecretEnv: "RAMP_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://api.ramp.com/v1/authorize",
			tokenEndpoint: "https://api.ramp.com/developer/v1/token",
			scopes: ["transactions:read", "reimbursements:read", "bills:read"],
			scopeSeparator: " ",
		},
	},
	{
		id: "supabase",
		name: "Supabase",
		description: "Inspect Supabase organizations, projects, Edge Functions, and branches.",
		setupUrl: "/profile?tab=providers&type=connector&connector=supabase",
		operations: [
			{ id: "list_organizations", access: "read" },
			{ id: "list_projects", access: "read" },
			{ id: "list_functions", access: "read" },
			{ id: "list_branches", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Management API access token",
			scopes: ["organizations:read", "projects:read", "edge_functions:read", "environment:read"],
		},
	},
	{
		id: "vercel",
		name: "Vercel",
		description: "Inspect Vercel projects, deployments, and build events.",
		setupUrl: "/profile?tab=providers&type=connector&connector=vercel",
		operations: [
			{ id: "list_projects", access: "read" },
			{ id: "list_deployments", access: "read" },
			{ id: "get_deployment_events", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Access token",
			scopes: ["projects:read", "deployments:read"],
		},
	},
	{
		id: "netlify",
		name: "Netlify",
		description: "Inspect Netlify sites, deploys, and deployment status.",
		setupUrl: "/profile?tab=providers&type=connector&connector=netlify",
		operations: [
			{ id: "list_sites", access: "read" },
			{ id: "list_deploys", access: "read" },
			{ id: "get_deploy", access: "read" },
		],
		auth: {
			authType: "api_key",
			credentialLabel: "Personal access token",
			scopes: ["sites:read", "deploys:read"],
		},
	},
	{
		id: "notion",
		name: "Notion",
		description: "Search pages and create reviewed pages in Notion.",
		setupUrl: "/profile?tab=providers&type=connector&connector=notion",
		operations: [
			{ id: "search", access: "read" },
			{ id: "retrieve_page", access: "read" },
			{ id: "create_page", access: "write" },
			{ id: "append_block_children", access: "write" },
		],
		auth: {
			authType: "oauth2",
			clientIdEnv: "NOTION_OAUTH_CLIENT_ID",
			clientSecretEnv: "NOTION_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
			tokenEndpoint: "https://api.notion.com/v1/oauth/token",
			scopes: [],
			scopeSeparator: " ",
			tokenAuth: "basic",
			tokenRequestFormat: "json",
			extraAuthorizationParams: {
				owner: "user",
			},
		},
	},
	{
		id: "github",
		name: "GitHub",
		description: "Use the existing GitHub App connection for repository workflows.",
		setupUrl: "/profile?tab=sandbox",
		operations: [],
		auth: {
			authType: "github_app",
			scopes: ["GitHub App installation"],
		},
	},
] as const satisfies ConnectorProviderConfig[];

export function getConnectorProviderConfig(
	providerId: string,
): ConnectorProviderConfig | undefined {
	return connectorProviders.find((provider) => provider.id === providerId);
}

export const recipeConnectorOperationIds = Array.from(
	new Set(
		connectorProviders.flatMap((provider) => provider.operations.map((operation) => operation.id)),
	),
);

export function getConnectorOperationConfig(
	providerId: RecipeConnectorProvider,
	operation: string,
): ConnectorOperationConfig | undefined {
	return getConnectorProviderConfig(providerId)?.operations.find((item) => item.id === operation);
}

export function isConnectorOperationSupported(
	providerId: RecipeConnectorProvider,
	operation: string,
): boolean {
	return Boolean(getConnectorOperationConfig(providerId, operation));
}

export function isConnectorOperationWrite(
	providerId: RecipeConnectorProvider,
	operation: string,
): boolean {
	return getConnectorOperationConfig(providerId, operation)?.access === "write";
}

export function isOAuthConnectorConfigured(env: IEnv, config: OAuthConnectorConfig): boolean {
	return Boolean(env[config.clientIdEnv] && env[config.clientSecretEnv]);
}

export function canStartOAuthConnectorAuthorization(
	env: IEnv,
	config: OAuthConnectorConfig,
): boolean {
	return isOAuthConnectorConfigured(env, config) && Boolean(env.JWT_SECRET?.trim());
}

export function getGitHubAppInstallUrl(env: IEnv): string | undefined {
	const explicitUrl = env.GITHUB_APP_INSTALL_URL?.trim();
	if (explicitUrl) {
		return explicitUrl;
	}

	const appSlug = env.GITHUB_APP_SLUG?.trim();
	return appSlug ? `https://github.com/apps/${appSlug}/installations/new` : undefined;
}

export function canAutoConnectGitHubApp(env: IEnv): boolean {
	return Boolean(env.GITHUB_APP_ID?.trim() && env.GITHUB_APP_PRIVATE_KEY?.trim());
}

export function getGitHubAppCallbackUrl(env: IEnv): string | undefined {
	return env.APP_BASE_URL
		? `${env.APP_BASE_URL.replace(/\/$/, "")}/profile?tab=sandbox`
		: undefined;
}
