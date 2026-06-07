import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { AppDataRepository, RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";

const listGitHubAppConnectionsForUserMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/github/connections", () => ({
	listGitHubAppConnectionsForUser: listGitHubAppConnectionsForUserMock,
}));

import { listRecipeConnectors } from "../index";

function createTestServiceContext(env: Record<string, string | undefined> = {}): ServiceContext {
	const testEnv: IEnv = Object.assign(Object.create(null), {
		DB: Object.create(null),
		...env,
	});
	const context = createServiceContext({ env: testEnv });
	const repositories = new RepositoryManager(testEnv);
	const appDataRepository: AppDataRepository = Object.assign(
		Object.create(AppDataRepository.prototype),
		{
			getAppDataByUserAppAndItem: vi.fn().mockResolvedValue([]),
		},
	);

	vi.spyOn(context, "repositories", "get").mockReturnValue(repositories);
	vi.spyOn(repositories, "appData", "get").mockReturnValue(appDataRepository);

	return context;
}

describe("recipe connectors", () => {
	beforeEach(() => {
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
});
