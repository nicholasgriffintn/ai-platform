import type { RecipeConnectorProvider } from "@assistant/schemas";
import type { IEnv } from "~/types";

export type ConnectorAuthType = "oauth2" | "github_app";

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
	extraAuthorizationParams?: Record<string, string>;
}

export interface GitHubAppConnectorConfig {
	authType: "github_app";
	scopes: string[];
}

export interface ConnectorProviderConfig {
	id: RecipeConnectorProvider;
	name: string;
	description: string;
	setupUrl: string;
	auth: OAuthConnectorConfig | GitHubAppConnectorConfig;
}

export const RECIPE_CONNECTOR_APP_ID = "recipe_connector_connection";
export const RECIPE_CONNECTOR_ITEM_TYPE = "oauth_connection";

export const connectorProviders = [
	{
		id: "gmail",
		name: "Gmail",
		description: "Search messages and create reviewed drafts in Gmail.",
		setupUrl: "/profile?tab=providers&type=connector&connector=gmail",
		auth: {
			authType: "oauth2",
			clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
			clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenEndpoint: "https://oauth2.googleapis.com/token",
			scopes: [
				"https://www.googleapis.com/auth/gmail.modify",
				"https://www.googleapis.com/auth/gmail.send",
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
		auth: {
			authType: "oauth2",
			clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
			clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
			authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			scopes: ["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite"],
			scopeSeparator: " ",
		},
	},
	{
		id: "linear",
		name: "Linear",
		description: "Search and create Linear issues for developer workflows.",
		setupUrl: "/profile?tab=providers&type=connector&connector=linear",
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
		id: "notion",
		name: "Notion",
		description: "Search pages and create reviewed pages in Notion.",
		setupUrl: "/profile?tab=providers&type=connector&connector=notion",
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

export function isOAuthConnectorConfigured(env: IEnv, config: OAuthConnectorConfig): boolean {
	return Boolean(env[config.clientIdEnv] && env[config.clientSecretEnv]);
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
