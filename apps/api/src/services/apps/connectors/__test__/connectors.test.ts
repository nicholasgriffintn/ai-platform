import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { AppDataRepository, RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";

const listGitHubAppConnectionsForUserMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/github/connections", () => ({
	listGitHubAppConnectionsForUser: listGitHubAppConnectionsForUserMock,
}));

import {
	completeRecipeConnectorAuthorization,
	getRecipeConnectorAccessToken,
	listRecipeConnectors,
	startRecipeConnectorAuthorization,
	storeRecipeConnectorApiKey,
} from "../index";

function createTestServiceContext(env: Record<string, string | undefined> = {}): ServiceContext {
	const testEnv: IEnv = Object.assign(Object.create(null), {
		DB: Object.create(null),
		...env,
	});
	const context = createServiceContext({ env: testEnv });
	const repositories = new RepositoryManager(testEnv);
	const storedRecords: Array<{
		id: string;
		user_id: number;
		app_id: string;
		item_id: string;
		item_type: string;
		data: string;
		created_at: string;
		updated_at: string;
	}> = [];
	const appDataRepository: AppDataRepository = Object.assign(
		Object.create(AppDataRepository.prototype),
		{
			getAppDataByUserAppAndItem: vi.fn(
				async (userId: number, appId: string, itemId: string, itemType: string) =>
					storedRecords.filter(
						(record) =>
							record.user_id === userId &&
							record.app_id === appId &&
							record.item_id === itemId &&
							record.item_type === itemType,
					),
			),
			createAppDataWithItem: vi.fn(
				async (
					userId: number,
					appId: string,
					itemId: string,
					itemType: string,
					data: Record<string, unknown>,
				) => {
					const record = {
						id: `record-${storedRecords.length + 1}`,
						user_id: userId,
						app_id: appId,
						item_id: itemId,
						item_type: itemType,
						data: JSON.stringify(data),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					storedRecords.push(record);
					return record;
				},
			),
			updateAppData: vi.fn(async (id: string, data: Record<string, unknown>) => {
				const record = storedRecords.find((item) => item.id === id);
				if (record) {
					record.data = JSON.stringify(data);
					record.updated_at = new Date().toISOString();
				}
			}),
		},
	);

	vi.spyOn(context, "repositories", "get").mockReturnValue(repositories);
	vi.spyOn(repositories, "appData", "get").mockReturnValue(appDataRepository);

	return context;
}

describe("recipe connectors", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		listGitHubAppConnectionsForUserMock.mockResolvedValue([]);
	});

	it("marks OAuth connectors as unconfigured when deployment credentials are missing", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext(),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		expect(response.connectors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "gmail",
					status: "unconfigured",
					authorizationUrl: undefined,
				}),
				expect.objectContaining({
					id: "github",
					status: "disconnected",
				}),
			]),
		);
	});

	it("returns authorization URLs for configured OAuth connectors", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				GOOGLE_OAUTH_CLIENT_ID: "google-client",
				GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const gmail = response.connectors.find((connector) => connector.id === "gmail");

		expect(gmail).toMatchObject({
			status: "disconnected",
		});
		expect(gmail?.authorizationUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
		expect(gmail?.authorizationUrl).toContain("client_id=google-client");
		expect(gmail?.operations).toEqual(["search_messages", "create_draft"]);
	});

	it("lists API-key connectors without OAuth authorization URLs", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const posthog = response.connectors.find((connector) => connector.id === "posthog");
		const vercel = response.connectors.find((connector) => connector.id === "vercel");
		const netlify = response.connectors.find((connector) => connector.id === "netlify");
		const cloudflare = response.connectors.find((connector) => connector.id === "cloudflare");
		const devin = response.connectors.find((connector) => connector.id === "devin");
		const supabase = response.connectors.find((connector) => connector.id === "supabase");
		const webflow = response.connectors.find((connector) => connector.id === "webflow");

		expect(posthog).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Personal API key",
			scopes: ["project:read", "query:read"],
			operations: ["list_projects", "query"],
		});
		expect(vercel).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Access token",
			scopes: ["projects:read", "deployments:read"],
			operations: ["list_projects", "list_deployments", "get_deployment_events"],
		});
		expect(netlify).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Personal access token",
			scopes: ["sites:read", "deploys:read"],
			operations: ["list_sites", "list_deploys", "get_deploy"],
		});
		expect(cloudflare).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "API token",
			scopes: ["Account:read", "Zone:read", "Workers Scripts:read"],
			operations: [
				"list_accounts",
				"list_zones",
				"list_workers",
				"list_worker_deployments",
				"get_worker_deployment",
			],
		});
		expect(devin).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Service user API key",
			scopes: ["sessions:read", "sessions:write"],
			operations: [
				"list_sessions",
				"get_session",
				"create_session",
				"list_messages",
				"send_message",
			],
		});
		expect(supabase).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Management API access token",
			scopes: ["organizations:read", "projects:read", "edge_functions:read", "environment:read"],
			operations: ["list_organizations", "list_projects", "list_functions", "list_branches"],
		});
		expect(webflow).toMatchObject({
			status: "disconnected",
			authType: "api_key",
			authorizationUrl: undefined,
			credentialLabel: "Data API token",
			scopes: ["sites:read", "cms:read"],
			operations: ["list_sites", "list_collections", "list_items"],
		});
	});

	it("stores API-key connector credentials in the connector credential store", async () => {
		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
		});

		await expect(
			storeRecipeConnectorApiKey({
				context,
				userId: 42,
				provider: "posthog",
				apiKey: " phx_test ",
			}),
		).resolves.toEqual({ success: true });

		await expect(
			getRecipeConnectorAccessToken({
				context,
				userId: 42,
				provider: "posthog",
			}),
		).resolves.toMatchObject({
			accessToken: "phx_test",
			scope: "project:read query:read",
		});

		const response = await listRecipeConnectors({
			context,
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});
		expect(response.connectors.find((connector) => connector.id === "posthog")).toMatchObject({
			status: "connected",
			authType: "api_key",
		});
	});

	it("does not start OAuth for API-key connectors", async () => {
		await expect(
			startRecipeConnectorAuthorization({
				context: createTestServiceContext({
					JWT_SECRET: "secret",
					API_BASE_URL: "https://api.polychat.test",
				}),
				userId: 42,
				provider: "posthog",
			}),
		).rejects.toThrow("Connector uses API-key setup");
	});

	it("marks OAuth connectors as unconfigured when state signing is unavailable", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				API_BASE_URL: "https://api.polychat.test",
				GOOGLE_OAUTH_CLIENT_ID: "google-client",
				GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const gmail = response.connectors.find((connector) => connector.id === "gmail");
		const calendar = response.connectors.find((connector) => connector.id === "calendar");

		expect(gmail).toMatchObject({
			status: "unconfigured",
			authorizationUrl: undefined,
		});
		expect(calendar).toMatchObject({
			status: "unconfigured",
			authorizationUrl: undefined,
		});
	});

	it("requests least-privilege scopes for implemented mail connector operations", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				GOOGLE_OAUTH_CLIENT_ID: "google-client",
				GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
				MICROSOFT_OAUTH_CLIENT_ID: "microsoft-client",
				MICROSOFT_OAUTH_CLIENT_SECRET: "microsoft-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const gmail = response.connectors.find((connector) => connector.id === "gmail");
		const outlook = response.connectors.find((connector) => connector.id === "outlook");

		expect(gmail?.scopes).toEqual([
			"https://www.googleapis.com/auth/gmail.readonly",
			"https://www.googleapis.com/auth/gmail.compose",
		]);
		expect(outlook?.scopes).toEqual([
			"offline_access",
			"User.Read",
			"Mail.ReadWrite",
			"Calendars.ReadWrite",
		]);
		expect(outlook?.operations).toEqual([
			"search_messages",
			"list_events",
			"create_draft",
			"create_calendar_event",
		]);
	});

	it("builds Notion OAuth URLs without an empty scope parameter", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				NOTION_OAUTH_CLIENT_ID: "notion-client",
				NOTION_OAUTH_CLIENT_SECRET: "notion-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const notion = response.connectors.find((connector) => connector.id === "notion");
		const authorizationUrl = new URL(notion?.authorizationUrl ?? "");

		expect(notion).toMatchObject({
			status: "disconnected",
			scopes: [],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://api.notion.com/v1/oauth/authorize",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("notion-client");
		expect(authorizationUrl.searchParams.get("owner")).toBe("user");
		expect(authorizationUrl.searchParams.has("scope")).toBe(false);
	});

	it("builds Todoist OAuth URLs with comma-separated data scopes", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				TODOIST_OAUTH_CLIENT_ID: "todoist-client",
				TODOIST_OAUTH_CLIENT_SECRET: "todoist-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const todoist = response.connectors.find((connector) => connector.id === "todoist");
		const authorizationUrl = new URL(todoist?.authorizationUrl ?? "");

		expect(todoist).toMatchObject({
			status: "disconnected",
			scopes: ["data:read_write"],
			operations: ["list_tasks", "create_task", "complete_task"],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://app.todoist.com/oauth/authorize",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("todoist-client");
		expect(authorizationUrl.searchParams.get("scope")).toBe("data:read_write");
	});

	it("builds Asana OAuth URLs with task and project scopes", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				ASANA_OAUTH_CLIENT_ID: "asana-client",
				ASANA_OAUTH_CLIENT_SECRET: "asana-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const asana = response.connectors.find((connector) => connector.id === "asana");
		const authorizationUrl = new URL(asana?.authorizationUrl ?? "");

		expect(asana).toMatchObject({
			status: "disconnected",
			scopes: ["tasks:read", "tasks:write", "projects:read"],
			operations: ["list_projects", "list_tasks", "create_task"],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://app.asana.com/-/oauth_authorize",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("asana-client");
		expect(authorizationUrl.searchParams.get("scope")).toBe("tasks:read tasks:write projects:read");
	});

	it("builds Sentry OAuth URLs with PKCE and read-only scopes", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				SENTRY_OAUTH_CLIENT_ID: "sentry-client",
				SENTRY_OAUTH_CLIENT_SECRET: "sentry-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const sentry = response.connectors.find((connector) => connector.id === "sentry");
		const authorizationUrl = new URL(sentry?.authorizationUrl ?? "");

		expect(sentry).toMatchObject({
			status: "disconnected",
			scopes: ["org:read", "project:read", "event:read"],
			operations: ["list_organizations", "list_projects", "list_issues", "retrieve_issue"],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://sentry.io/oauth/authorize/",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("sentry-client");
		expect(authorizationUrl.searchParams.get("scope")).toBe("org:read project:read event:read");
		expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
		expect(authorizationUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it("builds Fitbit OAuth URLs with read-only health scopes", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				FITBIT_OAUTH_CLIENT_ID: "fitbit-client",
				FITBIT_OAUTH_CLIENT_SECRET: "fitbit-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const fitbit = response.connectors.find((connector) => connector.id === "fitbit");
		const authorizationUrl = new URL(fitbit?.authorizationUrl ?? "");

		expect(fitbit).toMatchObject({
			status: "disconnected",
			scopes: ["profile", "activity", "sleep", "heartrate"],
			operations: ["profile", "daily_activity", "sleep_logs", "heart_rate"],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://www.fitbit.com/oauth2/authorize",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("fitbit-client");
		expect(authorizationUrl.searchParams.get("scope")).toBe("profile activity sleep heartrate");
	});

	it("builds Withings OAuth URLs with comma-separated health scopes", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				WITHINGS_OAUTH_CLIENT_ID: "withings-client",
				WITHINGS_OAUTH_CLIENT_SECRET: "withings-secret",
			}),
			userId: 42,
			requestUrl: "https://api.polychat.test/apps/connectors",
		});

		const withings = response.connectors.find((connector) => connector.id === "withings");
		const authorizationUrl = new URL(withings?.authorizationUrl ?? "");

		expect(withings).toMatchObject({
			status: "disconnected",
			scopes: ["user.info", "user.metrics", "user.activity"],
			operations: ["profile", "devices", "measurements", "activity", "sleep_summary"],
		});
		expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
			"https://account.withings.com/oauth2_user/authorize2",
		);
		expect(authorizationUrl.searchParams.get("client_id")).toBe("withings-client");
		expect(authorizationUrl.searchParams.get("scope")).toBe("user.info,user.metrics,user.activity");
	});

	it("completes Asana OAuth with a form token exchange", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				access_token: "asana-access-token",
				refresh_token: "asana-refresh-token",
				token_type: "bearer",
				expires_in: 3600,
				scope: "tasks:read tasks:write projects:read",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
			APP_BASE_URL: "https://app.polychat.test",
			ASANA_OAUTH_CLIENT_ID: "asana-client",
			ASANA_OAUTH_CLIENT_SECRET: "asana-secret",
		});
		const start = await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "asana",
			returnTo: "/profile?tab=providers&type=connector&connector=asana",
			requestUrl: "https://api.polychat.test/apps/connectors/asana/start",
		});
		const state = new URL(start.authorizationUrl).searchParams.get("state");

		const redirectUrl = await completeRecipeConnectorAuthorization({
			context,
			provider: "asana",
			code: "asana-oauth-code",
			state: state ?? "",
			requestUrl: "https://api.polychat.test/apps/connectors/asana/callback",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://app.asana.com/-/oauth_token",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				}),
			}),
		);

		const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
		if (!(tokenBody instanceof URLSearchParams)) {
			throw new Error("Expected Asana token exchange body to be URLSearchParams");
		}
		expect(tokenBody.get("grant_type")).toBe("authorization_code");
		expect(tokenBody.get("client_id")).toBe("asana-client");
		expect(tokenBody.get("client_secret")).toBe("asana-secret");
		expect(tokenBody.get("code")).toBe("asana-oauth-code");
		expect(tokenBody.get("redirect_uri")).toBe(
			"https://api.polychat.test/apps/connectors/asana/callback",
		);
		expect(redirectUrl).toBe(
			"https://app.polychat.test/profile?tab=providers&type=connector&connector=asana&connected=1",
		);

		const storedToken = await getRecipeConnectorAccessToken({
			context,
			userId: 42,
			provider: "asana",
		});
		expect(storedToken).toMatchObject({
			accessToken: "asana-access-token",
			refreshToken: "asana-refresh-token",
			tokenType: "bearer",
			scope: "tasks:read tasks:write projects:read",
		});
	});

	it("completes Fitbit OAuth with Basic token authentication", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				access_token: "fitbit-access-token",
				refresh_token: "fitbit-refresh-token",
				token_type: "Bearer",
				expires_in: 28800,
				scope: "profile activity sleep heartrate",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
			APP_BASE_URL: "https://app.polychat.test",
			FITBIT_OAUTH_CLIENT_ID: "fitbit-client",
			FITBIT_OAUTH_CLIENT_SECRET: "fitbit-secret",
		});
		const start = await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "fitbit",
			returnTo: "/profile?tab=providers&type=connector&connector=fitbit",
			requestUrl: "https://api.polychat.test/apps/connectors/fitbit/start",
		});
		const state = new URL(start.authorizationUrl).searchParams.get("state");

		const redirectUrl = await completeRecipeConnectorAuthorization({
			context,
			provider: "fitbit",
			code: "fitbit-oauth-code",
			state: state ?? "",
			requestUrl: "https://api.polychat.test/apps/connectors/fitbit/callback",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.fitbit.com/oauth2/token",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Basic Zml0Yml0LWNsaWVudDpmaXRiaXQtc2VjcmV0",
					"Content-Type": "application/x-www-form-urlencoded",
				}),
			}),
		);

		const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
		if (!(tokenBody instanceof URLSearchParams)) {
			throw new Error("Expected Fitbit token exchange body to be URLSearchParams");
		}
		expect(tokenBody.get("grant_type")).toBe("authorization_code");
		expect(tokenBody.get("client_id")).toBeNull();
		expect(tokenBody.get("client_secret")).toBeNull();
		expect(tokenBody.get("code")).toBe("fitbit-oauth-code");
		expect(tokenBody.get("redirect_uri")).toBe(
			"https://api.polychat.test/apps/connectors/fitbit/callback",
		);
		expect(redirectUrl).toBe(
			"https://app.polychat.test/profile?tab=providers&type=connector&connector=fitbit&connected=1",
		);

		await expect(
			getRecipeConnectorAccessToken({
				context,
				userId: 42,
				provider: "fitbit",
			}),
		).resolves.toMatchObject({
			accessToken: "fitbit-access-token",
			refreshToken: "fitbit-refresh-token",
			tokenType: "Bearer",
			scope: "profile activity sleep heartrate",
		});
	});

	it("completes Withings OAuth with requesttoken action and body-wrapped tokens", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				status: 0,
				body: {
					access_token: "withings-access-token",
					refresh_token: "withings-refresh-token",
					token_type: "Bearer",
					expires_in: 10800,
					scope: "user.info,user.metrics,user.activity",
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
			APP_BASE_URL: "https://app.polychat.test",
			WITHINGS_OAUTH_CLIENT_ID: "withings-client",
			WITHINGS_OAUTH_CLIENT_SECRET: "withings-secret",
		});
		const start = await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "withings",
			returnTo: "/profile?tab=providers&type=connector&connector=withings",
			requestUrl: "https://api.polychat.test/apps/connectors/withings/start",
		});
		const state = new URL(start.authorizationUrl).searchParams.get("state");

		const redirectUrl = await completeRecipeConnectorAuthorization({
			context,
			provider: "withings",
			code: "withings-oauth-code",
			state: state ?? "",
			requestUrl: "https://api.polychat.test/apps/connectors/withings/callback",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://wbsapi.withings.net/v2/oauth2",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				}),
			}),
		);

		const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
		if (!(tokenBody instanceof URLSearchParams)) {
			throw new Error("Expected Withings token exchange body to be URLSearchParams");
		}
		expect(tokenBody.get("action")).toBe("requesttoken");
		expect(tokenBody.get("grant_type")).toBe("authorization_code");
		expect(tokenBody.get("client_id")).toBe("withings-client");
		expect(tokenBody.get("client_secret")).toBe("withings-secret");
		expect(tokenBody.get("code")).toBe("withings-oauth-code");
		expect(tokenBody.get("redirect_uri")).toBe(
			"https://api.polychat.test/apps/connectors/withings/callback",
		);
		expect(redirectUrl).toBe(
			"https://app.polychat.test/profile?tab=providers&type=connector&connector=withings&connected=1",
		);

		await expect(
			getRecipeConnectorAccessToken({
				context,
				userId: 42,
				provider: "withings",
			}),
		).resolves.toMatchObject({
			accessToken: "withings-access-token",
			refreshToken: "withings-refresh-token",
			tokenType: "Bearer",
			scope: "user.info,user.metrics,user.activity",
		});
	});

	it("completes Sentry OAuth with the encrypted PKCE verifier", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				access_token: "sentry-access-token",
				refresh_token: "sentry-refresh-token",
				token_type: "bearer",
				expires_in: 2591999,
				scope: "org:read project:read event:read",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
			APP_BASE_URL: "https://app.polychat.test",
			SENTRY_OAUTH_CLIENT_ID: "sentry-client",
			SENTRY_OAUTH_CLIENT_SECRET: "sentry-secret",
		});
		const start = await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "sentry",
			returnTo: "/profile?tab=providers&type=connector&connector=sentry",
			requestUrl: "https://api.polychat.test/apps/connectors/sentry/start",
		});
		const authorizationUrl = new URL(start.authorizationUrl);
		const state = authorizationUrl.searchParams.get("state");

		const redirectUrl = await completeRecipeConnectorAuthorization({
			context,
			provider: "sentry",
			code: "sentry-oauth-code",
			state: state ?? "",
			requestUrl: "https://api.polychat.test/apps/connectors/sentry/callback",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://sentry.io/oauth/token/",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				}),
			}),
		);

		const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
		if (!(tokenBody instanceof URLSearchParams)) {
			throw new Error("Expected Sentry token exchange body to be URLSearchParams");
		}
		expect(tokenBody.get("grant_type")).toBe("authorization_code");
		expect(tokenBody.get("client_id")).toBe("sentry-client");
		expect(tokenBody.get("client_secret")).toBe("sentry-secret");
		expect(tokenBody.get("code")).toBe("sentry-oauth-code");
		expect(tokenBody.get("redirect_uri")).toBe(
			"https://api.polychat.test/apps/connectors/sentry/callback",
		);
		expect(tokenBody.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(tokenBody.get("code_verifier")).not.toBe(
			authorizationUrl.searchParams.get("code_challenge"),
		);
		expect(redirectUrl).toBe(
			"https://app.polychat.test/profile?tab=providers&type=connector&connector=sentry&connected=1",
		);
	});

	it("redacts sensitive OAuth token exchange errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: "invalid_grant",
							access_token: "Abcdef1234567890Ghijklm_Nopqrs",
							refresh_token: "Refresh1234567890Secret",
						}),
						{ status: 400 },
					),
			),
		);
		const context = createTestServiceContext({
			JWT_SECRET: "secret",
			API_BASE_URL: "https://api.polychat.test",
			GOOGLE_OAUTH_CLIENT_ID: "google-client",
			GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
		});
		const start = await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "gmail",
			requestUrl: "https://api.polychat.test/apps/connectors/gmail/start",
		});
		const state = new URL(start.authorizationUrl).searchParams.get("state");

		await expect(
			completeRecipeConnectorAuthorization({
				context,
				provider: "gmail",
				code: "oauth-code",
				state: state ?? "",
				requestUrl: "https://api.polychat.test/apps/connectors/gmail/callback",
			}),
		).rejects.toThrow(/"access_token":"\[redacted\]"/);
		await expect(
			completeRecipeConnectorAuthorization({
				context,
				provider: "gmail",
				code: "oauth-code",
				state: state ?? "",
				requestUrl: "https://api.polychat.test/apps/connectors/gmail/callback",
			}),
		).rejects.not.toThrow("Abcdef1234567890Ghijklm_Nopqrs");
	});

	it("fails expired connector token refresh with a reconnect-safe redacted error", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
			const fetchMock = vi.fn(async () =>
				Response.json({
					access_token: "initial-access-token",
					refresh_token: "refresh-token-secret",
					token_type: "Bearer",
					expires_in: 1,
				}),
			);
			vi.stubGlobal("fetch", fetchMock);
			const context = createTestServiceContext({
				JWT_SECRET: "secret",
				API_BASE_URL: "https://api.polychat.test",
				GOOGLE_OAUTH_CLIENT_ID: "google-client",
				GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
			});
			const start = await startRecipeConnectorAuthorization({
				context,
				userId: 42,
				provider: "gmail",
				requestUrl: "https://api.polychat.test/apps/connectors/gmail/start",
			});
			const state = new URL(start.authorizationUrl).searchParams.get("state");
			await completeRecipeConnectorAuthorization({
				context,
				provider: "gmail",
				code: "oauth-code",
				state: state ?? "",
				requestUrl: "https://api.polychat.test/apps/connectors/gmail/callback",
			});

			vi.setSystemTime(new Date("2026-06-07T10:05:00.000Z"));
			fetchMock.mockResolvedValueOnce(
				Response.json(
					{
						error: "invalid_grant",
						refresh_token: "refresh-token-secret",
						access_token: "leaked-access-token",
					},
					{ status: 401 },
				),
			);

			let error: unknown;
			try {
				await getRecipeConnectorAccessToken({
					context,
					userId: 42,
					provider: "gmail",
				});
			} catch (thrown) {
				error = thrown;
			}

			expect(error).toBeInstanceOf(Error);
			const message = error instanceof Error ? error.message : "";
			expect(message).toContain("Reconnect this provider");
			expect(message).not.toContain("refresh-token-secret");
			expect(message).not.toContain("leaked-access-token");
		} finally {
			vi.useRealTimers();
		}
	});
});
