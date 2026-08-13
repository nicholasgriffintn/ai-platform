import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { ProviderConnectionRepository, RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { ErrorType } from "~/utils/errors";
import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";

import {
	deleteRecipeConnectorConnection,
	listRecipeConnectors,
	startRecipeConnectorAuthorization,
	verifyComposioConnectorAuthorization,
} from "../index";

function createTestServiceContext(env: Record<string, string | undefined> = {}): ServiceContext {
	const testEnv: IEnv = Object.assign(Object.create(null), {
		DB: Object.create(null),
		COMPOSIO_USER_NAMESPACE: "test",
		...env,
	});
	const context = createServiceContext({ env: testEnv });
	const repositories = new RepositoryManager(testEnv);
	const providerConnections: ProviderConnectionRepository = Object.assign(
		Object.create(ProviderConnectionRepository.prototype),
		{
			getConnection: vi.fn(async () => null),
			upsertConnection: vi.fn(),
			deleteConnection: vi.fn(),
		},
	);
	vi.spyOn(context, "repositories", "get").mockReturnValue(repositories);
	vi.spyOn(repositories, "providerConnections", "get").mockReturnValue(providerConnections);
	vi.spyOn(repositories, "composioConnectorSessions", "get").mockReturnValue({
		create: vi.fn(async (input) => ({ id: "ccs_connection", ...input })),
	} as never);
	return context;
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

const authConfigIds = {
	gmail: "ac_uRCWNPtnTpEw",
	posthog: "ac_jQVn4kRgdLDa",
} as const;

function activeAccount(toolkitSlug: keyof typeof authConfigIds, id = `ca_${toolkitSlug}`) {
	return {
		id,
		user_id: "polychat:test:user:42",
		toolkit: { slug: toolkitSlug },
		auth_config: { id: authConfigIds[toolkitSlug] },
		status: "ACTIVE",
		status_reason: null,
		is_disabled: false,
		created_at: "2026-08-12T10:00:00.000Z",
		updated_at: "2026-08-12T11:00:00.000Z",
	};
}

describe("recipe connectors", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("marks Composio connectors unconfigured without the project API key", async () => {
		const response = await listRecipeConnectors({
			context: createTestServiceContext(),
			userId: 42,
		});

		expect(response.connectors.find((connector) => connector.id === "gmail")).toMatchObject({
			authType: "composio",
			status: "unconfigured",
			authorizationUrl: undefined,
		});
		expect(response.connectors.find((connector) => connector.id === "cloudflare")).toMatchObject({
			authType: "composio",
			status: "unconfigured",
		});
	});

	it("derives migrated connection state from the user's active Composio accounts", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
			jsonResponse({ items: [activeAccount("gmail")], next_cursor: null }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const response = await listRecipeConnectors({
			context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
			userId: 42,
		});

		expect(response.connectors.find((connector) => connector.id === "gmail")).toMatchObject({
			authType: "composio",
			status: "connected",
			connectedAt: "2026-08-12T10:00:00.000Z",
			updatedAt: "2026-08-12T11:00:00.000Z",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("user_ids=polychat%3Atest%3Auser%3A42");
	});

	it("creates a managed OAuth link from the configured auth config", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith(`/auth_configs/${authConfigIds.gmail}`)) {
				return jsonResponse({
					id: authConfigIds.gmail,
					name: "polychat-gmail",
					toolkit: { slug: "gmail" },
					auth_scheme: "OAUTH2",
					is_composio_managed: true,
					status: "ENABLED",
					restrict_to_following_tools: null,
				});
			}
			if (url.endsWith("/connected_accounts/link")) {
				const body = JSON.parse(String(init?.body));
				expect(body).toMatchObject({
					user_id: "polychat:test:user:42",
					auth_config_id: authConfigIds.gmail,
					allow_multiple: false,
				});
				return jsonResponse(
					{
						redirect_url: "https://app.composio.dev/link/link-token",
						id: "ca_gmail",
					},
					201,
				);
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await startRecipeConnectorAuthorization({
			context: createTestServiceContext({
				COMPOSIO_API_KEY: "composio-secret",
				API_BASE_URL: "https://api.polychat.test",
			}),
			userId: 42,
			provider: "gmail",
			returnTo: "/projects/17",
		});

		expect(result).toEqual({
			provider: "gmail",
			authorizationUrl: "https://app.composio.dev/link/link-token",
		});
		const linkBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
		expect(linkBody.callback_url).toBe("https://api.polychat.test/apps/connectors/composio/verify");
	});

	it("uses the configured API-key auth config without handling the user's key", async () => {
		const requestBodies: Array<Record<string, unknown>> = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (init?.body) requestBodies.push(JSON.parse(String(init.body)));
			if (url.endsWith(`/auth_configs/${authConfigIds.posthog}`)) {
				return jsonResponse({
					id: authConfigIds.posthog,
					name: "posthog-k4nf99",
					toolkit: { slug: "posthog" },
					auth_scheme: "API_KEY",
					is_composio_managed: false,
					status: "ENABLED",
					restrict_to_following_tools: null,
				});
			}
			if (url.endsWith("/tool_router/session")) {
				return jsonResponse({ session_id: "trs_posthog" }, 201);
			}
			return jsonResponse(
				{
					redirect_url: "https://app.composio.dev/link/posthog",
					connected_account_id: "ca_posthog",
				},
				201,
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const context = createTestServiceContext({
			COMPOSIO_API_KEY: "composio-secret",
			APP_BASE_URL: "https://polychat.test",
		});
		const createSession = vi.mocked(context.repositories.composioConnectorSessions.create);
		await startRecipeConnectorAuthorization({
			context,
			userId: 42,
			provider: "posthog",
			returnTo: "https://attacker.test/steal",
		});

		expect(requestBodies[0]).toMatchObject({
			user_id: "polychat:test:user:42",
			auth_configs: { posthog: authConfigIds.posthog },
		});
		expect(requestBodies.at(-1)).toMatchObject({
			callback_url: "https://polychat.test/profile?tab=providers&type=connector",
		});
		expect(createSession).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "connection",
				remoteSessionId: "trs_posthog",
				connectedAccountId: "ca_posthog",
				allowedOperationIds: [],
				expiresAt: expect.any(String),
			}),
		);
		const persisted = createSession.mock.calls[0]?.[0];
		expect(Date.parse(persisted.expiresAt) - Date.parse(persisted.createdAt)).toBe(60 * 60 * 1000);
	});

	it("keeps duplicate auth configs under one exact toolkit connector and requires an explicit choice", async () => {
		const whatsapp = configuredComposioToolkits.whatsapp;
		expect(whatsapp.providerId).toBe("whatsapp");
		expect(whatsapp.authConfigs).toHaveLength(2);

		await expect(
			startRecipeConnectorAuthorization({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				provider: "whatsapp",
			}),
		).rejects.toMatchObject({
			message: "Connector auth config is required",
			statusCode: 400,
		});

		const selected = whatsapp.authConfigs[1];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith(`/auth_configs/${selected.id}`)) {
				return jsonResponse({
					id: selected.id,
					name: selected.name,
					toolkit: { slug: "whatsapp" },
					auth_scheme: selected.authScheme,
					is_composio_managed: selected.isManaged,
					status: "ENABLED",
					restrict_to_following_tools: null,
				});
			}
			if (url.endsWith("/tool_router/session")) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					auth_configs: { whatsapp: selected.id },
				});
				return jsonResponse({ session_id: "trs_whatsapp" }, 201);
			}
			return jsonResponse(
				{
					redirect_url: "https://app.composio.dev/link/whatsapp",
					connected_account_id: "ca_whatsapp",
				},
				201,
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			startRecipeConnectorAuthorization({
				context: createTestServiceContext({
					COMPOSIO_API_KEY: "composio-secret",
					API_BASE_URL: "https://api.polychat.test",
				}),
				userId: 42,
				provider: "whatsapp",
				authConfigId: selected.id,
			}),
		).resolves.toMatchObject({ provider: "whatsapp" });
	});

	it("completes callback identity verification with the authenticated user", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/connected_accounts/complete_auth")) {
				expect(JSON.parse(String(init?.body))).toEqual({
					session_uri: "session-uri-once",
					user_id: "polychat:test:user:42",
				});
				return jsonResponse({ connected_account_id: "ca_gmail", toolkit_slug: "gmail" });
			}
			return jsonResponse({ items: [activeAccount("gmail")], next_cursor: null });
		});
		vi.stubGlobal("fetch", fetchMock);

		const redirect = await verifyComposioConnectorAuthorization({
			context: createTestServiceContext({
				COMPOSIO_API_KEY: "composio-secret",
				APP_BASE_URL: "https://polychat.test",
			}),
			userId: 42,
			sessionUri: "session-uri-once",
		});

		expect(redirect).toBe(
			"https://polychat.test/profile?tab=providers&type=connector&connector=gmail&connected=1",
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("verifies an ordinary Connect Link callback against the authenticated user", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			expect(String(input)).toContain("connected_account_ids=ca_googleslides");
			expect(String(input)).toContain("user_ids=polychat%3Atest%3Auser%3A42");
			return jsonResponse({
				items: [
					{
						...activeAccount("gmail", "ca_googleslides"),
						toolkit: { slug: "googleslides" },
						auth_config: { id: configuredComposioToolkits.googleslides.authConfigs[0].id },
					},
				],
				next_cursor: null,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			verifyComposioConnectorAuthorization({
				context: createTestServiceContext({
					COMPOSIO_API_KEY: "composio-secret",
					APP_BASE_URL: "https://polychat.test",
				}),
				userId: 42,
				status: "success",
				connectedAccountId: "ca_googleslides",
			}),
		).resolves.toBe(
			"https://polychat.test/profile?tab=providers&type=connector&connector=googleslides&connected=1",
		);
	});

	it("rejects an ordinary Connect Link callback for another Composio user", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					items: [
						{
							...activeAccount("gmail", "ca_googleslides"),
							user_id: "polychat:test:user:7",
							toolkit: { slug: "googleslides" },
							auth_config: {
								id: configuredComposioToolkits.googleslides.authConfigs[0].id,
							},
						},
					],
					next_cursor: null,
				}),
			),
		);

		await expect(
			verifyComposioConnectorAuthorization({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				status: "success",
				connectedAccountId: "ca_googleslides",
			}),
		).rejects.toMatchObject({
			message: "Composio connection verification failed",
			type: ErrorType.AUTHORISATION_ERROR,
			statusCode: 403,
		});
	});

	it("rejects a callback account that belongs to a different Composio user", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ connected_account_id: "ca_gmail", toolkit_slug: "gmail" }),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					items: [{ ...activeAccount("gmail"), user_id: "polychat:test:user:7" }],
					next_cursor: null,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			verifyComposioConnectorAuthorization({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				sessionUri: "session-uri-once",
			}),
		).rejects.toMatchObject({
			message: "Composio connection verification failed",
			type: ErrorType.AUTHORISATION_ERROR,
			statusCode: 403,
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rejects a callback when the completed account is not in the user's account list", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ connected_account_id: "ca_gmail", toolkit_slug: "gmail" }),
			)
			.mockResolvedValueOnce(
				jsonResponse({ items: [activeAccount("gmail", "ca_other")], next_cursor: null }),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			verifyComposioConnectorAuthorization({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				sessionUri: "session-uri-once",
			}),
		).rejects.toMatchObject({ statusCode: 403 });
	});

	it.each([
		{
			name: "replayed",
			status: 409,
			body: { message: "session URI has already been consumed" },
			type: ErrorType.CONFLICT_ERROR,
		},
		{
			name: "expired",
			status: 400,
			body: { error: { message: "session URI has expired" } },
			type: ErrorType.EXTERNAL_API_ERROR,
		},
	])(
		"surfaces a $name callback error without attempting account verification",
		async (testCase) => {
			const fetchMock = vi.fn(async () => jsonResponse(testCase.body, testCase.status));
			vi.stubGlobal("fetch", fetchMock);

			await expect(
				verifyComposioConnectorAuthorization({
					context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
					userId: 42,
					sessionUri: "session-uri-once",
				}),
			).rejects.toMatchObject({
				message: "Composio request failed",
				type: testCase.type,
				statusCode: testCase.status,
			});
			expect(fetchMock).toHaveBeenCalledTimes(1);
		},
	);

	it("rejects a verified toolkit outside the generated registry", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(
					jsonResponse({ connected_account_id: "ca_unknown", toolkit_slug: "unknown" }),
				)
				.mockResolvedValueOnce(jsonResponse({ items: [], next_cursor: null })),
		);

		await expect(
			verifyComposioConnectorAuthorization({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				sessionUri: "session-uri-once",
			}),
		).rejects.toMatchObject({ statusCode: 403 });
	});

	it("revokes a user's explicit account before deleting it", async () => {
		const requests: Array<{ url: string; method: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				requests.push({ url: String(input), method: init?.method ?? "GET" });
				if (String(input).includes("/connected_accounts?")) {
					return jsonResponse({ items: [activeAccount("gmail")], next_cursor: null });
				}
				return jsonResponse({ success: true });
			}),
		);

		await expect(
			deleteRecipeConnectorConnection({
				context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
				userId: 42,
				provider: "gmail",
			}),
		).resolves.toEqual({ success: true });
		expect(requests.slice(1)).toEqual([
			{
				url: "https://backend.composio.dev/api/v3.1/connected_accounts/ca_gmail/revoke",
				method: "POST",
			},
			{
				url: "https://backend.composio.dev/api/v3.1/connected_accounts/ca_gmail",
				method: "DELETE",
			},
		]);
	});

	it("revokes an inactive OAuth account before deleting it", async () => {
		const requests: Array<{ url: string; method: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				requests.push({ url: String(input), method: init?.method ?? "GET" });
				if (String(input).includes("/connected_accounts?")) {
					return jsonResponse({
						items: [{ ...activeAccount("gmail"), status: "INACTIVE", is_disabled: true }],
						next_cursor: null,
					});
				}
				return jsonResponse({ success: true });
			}),
		);

		await deleteRecipeConnectorConnection({
			context: createTestServiceContext({ COMPOSIO_API_KEY: "composio-secret" }),
			userId: 42,
			provider: "gmail",
		});

		expect(requests.slice(1).map((request) => request.url)).toEqual([
			"https://backend.composio.dev/api/v3.1/connected_accounts/ca_gmail/revoke",
			"https://backend.composio.dev/api/v3.1/connected_accounts/ca_gmail",
		]);
	});
});
