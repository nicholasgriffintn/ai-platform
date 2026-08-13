import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import { ErrorType } from "~/utils/errors";
import type { ConnectorProviderConfig } from "../..";
import {
	completeComposioAuthorization,
	createComposioConnectLink,
	createComposioToolSession,
	deleteComposioToolSession,
	disconnectComposioAccount,
	executeComposioSessionTool,
	listComposioConnectedAccounts,
	searchComposioSessionTools,
} from "../client";

function createEnv(): IEnv {
	return Object.assign(Object.create(null), {
		COMPOSIO_API_KEY: "composio-secret",
		COMPOSIO_USER_NAMESPACE: "test",
	});
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function account(id: string, toolkitSlug: string) {
	return {
		id,
		user_id: "polychat:test:user:42",
		toolkit: { slug: toolkitSlug },
		status: "ACTIVE",
		status_reason: null,
		is_disabled: false,
		created_at: "2026-08-12T10:00:00.000Z",
		updated_at: "2026-08-12T11:00:00.000Z",
	};
}

function gmailProvider(authConfigId = "ac_gmail"): ConnectorProviderConfig {
	return {
		id: "gmail",
		name: "Gmail",
		description: "Test Gmail provider",
		categories: [],
		setupUrl: "/profile",
		operations: [
			{
				id: "GMAIL_FETCH_EMAILS",
				access: "read",
				authConfigIds: [authConfigId],
				inputSchema: { type: "object", properties: {} },
			},
		],
		auth: {
			authType: "composio",
			toolkitSlug: "gmail",
			toolkitVersion: "20260721_00",
			authConfigs: [{ id: authConfigId, name: "gmail", authScheme: "OAUTH2", isManaged: true }],
			scopes: [],
		},
	};
}

describe("Composio REST client", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("paginates account reads with the explicit user and toolkit filters", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ items: [account("ca_gmail", "gmail"), null], next_cursor: "page-2" }),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					items: [account("ca_gmail", "gmail"), account("ca_outlook", "outlook")],
					next_cursor: null,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			listComposioConnectedAccounts({
				env: createEnv(),
				userId: 42,
				toolkitSlugs: ["gmail", "outlook"],
			}),
		).resolves.toEqual([
			expect.objectContaining({
				id: "ca_gmail",
				userId: "polychat:test:user:42",
				toolkitSlug: "gmail",
			}),
			expect.objectContaining({ id: "ca_outlook", toolkitSlug: "outlook" }),
		]);

		const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
		expect(firstUrl.pathname).toBe("/api/v3.1/connected_accounts");
		expect(Object.fromEntries(firstUrl.searchParams)).toMatchObject({
			user_ids: "polychat:test:user:42",
			toolkit_slugs: "gmail,outlook",
			limit: "50",
			order_by: "updated_at",
			order_direction: "desc",
		});
		const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
		expect(secondUrl.searchParams.get("cursor")).toBe("page-2");
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
			method: "GET",
			headers: expect.objectContaining({
				Accept: "application/json",
				"Content-Type": "application/json",
				"x-api-key": "composio-secret",
			}),
		});
	});

	it("fails closed when account pagination exceeds the safety limit", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ items: [], next_cursor: "more" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			listComposioConnectedAccounts({ env: createEnv(), userId: 42 }),
		).rejects.toMatchObject({
			message: "Composio account pagination exceeded its safety limit",
			type: ErrorType.EXTERNAL_API_ERROR,
			statusCode: 502,
		});
		expect(fetchMock).toHaveBeenCalledTimes(20);
	});

	it("reports a malformed successful account envelope as an upstream contract error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse(null)),
		);

		await expect(
			listComposioConnectedAccounts({ env: createEnv(), userId: 42 }),
		).rejects.toMatchObject({
			message: "Composio account response is invalid",
			type: ErrorType.EXTERNAL_API_ERROR,
			statusCode: 502,
		});
	});

	it("sends callback verification identity in the documented completion body", async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({ connected_account_id: "ca_gmail", toolkit_slug: "gmail" }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			completeComposioAuthorization({
				env: createEnv(),
				userId: 42,
				sessionUri: "session-uri-once",
			}),
		).resolves.toEqual({ connectedAccountId: "ca_gmail", toolkitSlug: "gmail" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://backend.composio.dev/api/v3.1/connected_accounts/complete_auth",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					session_uri: "session-uri-once",
					user_id: "polychat:test:user:42",
				}),
			}),
		);
	});

	it("rejects a malformed successful callback completion envelope", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ connected_account_id: "ca_gmail" })),
		);

		await expect(
			completeComposioAuthorization({
				env: createEnv(),
				userId: 42,
				sessionUri: "session-uri-once",
			}),
		).rejects.toMatchObject({
			message: "Composio verification response is invalid",
			type: ErrorType.EXTERNAL_API_ERROR,
			statusCode: 502,
		});
	});

	it("does not delete when OAuth revocation fails", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ error: "revocation failed" }, 409));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			disconnectComposioAccount({ env: createEnv(), connectedAccountId: "ca/gmail" }),
		).rejects.toMatchObject({ statusCode: 409 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://backend.composio.dev/api/v3.1/connected_accounts/ca%2Fgmail/revoke",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("deletes API-key accounts without calling OAuth revocation", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ success: true }));
		vi.stubGlobal("fetch", fetchMock);

		await disconnectComposioAccount({
			env: createEnv(),
			connectedAccountId: "ca_posthog",
			revokeAtProvider: false,
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://backend.composio.dev/api/v3.1/connected_accounts/ca_posthog",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("loads the configured auth config directly by ID", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/auth_configs/ac_gmail")) {
				return jsonResponse({
					id: "ac_gmail",
					name: "Polychat Gmail",
					toolkit: { slug: "gmail" },
					auth_scheme: "OAUTH2",
					is_composio_managed: true,
					status: "ENABLED",
					restrict_to_following_tools: ["GMAIL_FETCH_EMAILS"],
				});
			}
			if (url.endsWith("/tool_router/session")) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					auth_configs: { gmail: "ac_gmail" },
				});
				return jsonResponse({ session_id: "trs_gmail" }, 201);
			}
			return jsonResponse(
				{
					redirect_url: "https://connect.composio.dev/link/token",
					connected_account_id: "ca_gmail",
				},
				201,
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			createComposioConnectLink({
				env: createEnv(),
				userId: 42,
				provider: gmailProvider(),
				authConfigId: "ac_gmail",
				callbackUrl: "https://api.polychat.test/apps/connectors/composio/verify",
			}),
		).resolves.toEqual({
			redirectUrl: "https://connect.composio.dev/link/token",
			connectedAccountId: "ca_gmail",
		});

		expect(
			fetchMock.mock.calls.some(
				([input, init]) => String(input).endsWith("/auth_configs") && init?.method === "POST",
			),
		).toBe(false);
	});

	it("uses and validates an explicitly configured auth config without searching or creating", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/auth_configs/ac_configured")) {
				return jsonResponse({
					id: "ac_configured",
					name: "gmail-configured",
					toolkit: { slug: "gmail" },
					auth_scheme: "OAUTH2",
					is_composio_managed: true,
					status: "ENABLED",
					restrict_to_following_tools: [],
				});
			}
			if (url.endsWith("/tool_router/session")) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					auth_configs: { gmail: "ac_configured" },
				});
				return jsonResponse({ session_id: "trs_gmail" }, 201);
			}
			return jsonResponse(
				{
					redirect_url: "https://connect.composio.dev/link/token",
					connected_account_id: "ca_gmail",
				},
				201,
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await createComposioConnectLink({
			env: createEnv(),
			userId: 42,
			provider: gmailProvider("ac_configured"),
			authConfigId: "ac_configured",
			callbackUrl: "https://api.polychat.test/apps/connectors/composio/verify",
		});

		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/auth_configs?"))).toBe(
			false,
		);
		expect(
			fetchMock.mock.calls.some(
				([input, init]) => String(input).endsWith("/auth_configs") && init?.method === "POST",
			),
		).toBe(false);
	});

	it("rejects a connect-link redirect outside the documented Composio origin", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					id: "ac_gmail",
					name: "Polychat Gmail",
					toolkit: { slug: "gmail" },
					auth_scheme: "OAUTH2",
					is_composio_managed: true,
					status: "ENABLED",
					restrict_to_following_tools: [],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ session_id: "trs_gmail" }, 201))
			.mockResolvedValueOnce(
				jsonResponse(
					{
						redirect_url: "https://attacker.example/link/token",
						connected_account_id: "ca_gmail",
					},
					201,
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			createComposioConnectLink({
				env: createEnv(),
				userId: 42,
				provider: gmailProvider(),
				authConfigId: "ac_gmail",
				callbackUrl: "https://api.polychat.test/apps/connectors/composio/verify",
			}),
		).rejects.toMatchObject({ message: "Composio link response is invalid", statusCode: 502 });
	});

	it("creates a connector-scoped tool session for the exact account and operations", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(JSON.parse(String(init?.body))).toMatchObject({
				user_id: "polychat:test:user:42",
				toolkits: { enable: ["gmail"] },
				auth_configs: { gmail: "ac_gmail" },
				connected_accounts: { gmail: ["ca_gmail"] },
				tools: { gmail: { enable: ["GMAIL_FETCH_EMAILS"] } },
				workbench: { enable: false, enable_proxy_execution: false },
				execute: { enable_multi_execute: false },
			});
			return jsonResponse({ session_id: "trs_gmail" }, 201);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			createComposioToolSession({
				env: createEnv(),
				userId: 42,
				provider: gmailProvider(),
				connectedAccount: {
					id: "ca_gmail",
					userId: "polychat:test:user:42",
					toolkitSlug: "gmail",
					authConfigId: "ac_gmail",
					status: "ACTIVE",
					createdAt: "2026-08-12T10:00:00.000Z",
					updatedAt: "2026-08-12T11:00:00.000Z",
					isDisabled: false,
				},
				allowedToolSlugs: ["GMAIL_FETCH_EMAILS", "NOT_A_GMAIL_TOOL"],
			}),
		).resolves.toBe("trs_gmail");
	});

	it("returns authoritative schemas when Composio capitalises the toolkit slug", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					results: [
						{
							execution_guidance: "Search before drafting.",
							recommended_plan_steps: ["Find messages"],
							known_pitfalls: ["Use pagination"],
						},
					],
					tool_schemas: {
						GMAIL_FETCH_EMAILS: {
							toolkit: "GMAIL",
							tool_slug: "GMAIL_FETCH_EMAILS",
							description: "Find matching email messages.",
							input_schema: { type: "object", properties: { query: { type: "string" } } },
						},
					},
				}),
			),
		);

		await expect(
			searchComposioSessionTools({
				env: createEnv(),
				sessionId: "trs_gmail",
				provider: gmailProvider(),
				useCase: "Find the latest invoice email",
			}),
		).resolves.toMatchObject({
			sessionId: "trs_gmail",
			executionGuidance: "Search before drafting.",
			tools: [
				{
					slug: "GMAIL_FETCH_EMAILS",
					toolkitSlug: "gmail",
					access: "read",
					inputSchema: { type: "object" },
				},
			],
		});
	});

	it("resolves referenced schemas returned by session search", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					results: [{}],
					tool_schemas: {
						GMAIL_FETCH_EMAILS: {
							toolkit: "GMAIL",
							tool_slug: "GMAIL_FETCH_EMAILS",
							description: "Find matching email messages.",
							hasFullSchema: false,
							schemaRef: {
								tool: "COMPOSIO_GET_TOOL_SCHEMAS",
								args: { tool_slugs: ["GMAIL_FETCH_EMAILS"] },
							},
						},
					},
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					data: {
						success: true,
						tool_schemas: {
							GMAIL_FETCH_EMAILS: {
								toolkit: "GMAIL",
								tool_slug: "GMAIL_FETCH_EMAILS",
								description: "Find matching email messages.",
								input_schema: {
									type: "object",
									properties: { query: { type: "string" } },
								},
							},
						},
					},
					error: null,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			searchComposioSessionTools({
				env: createEnv(),
				sessionId: "trs_gmail",
				provider: gmailProvider(),
				useCase: "Find the latest invoice email",
			}),
		).resolves.toMatchObject({
			tools: [{ slug: "GMAIL_FETCH_EMAILS", inputSchema: { type: "object" } }],
		});
		expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
			slug: "COMPOSIO_GET_TOOL_SCHEMAS",
			arguments: {
				tool_slugs: ["GMAIL_FETCH_EMAILS"],
				include: ["input_schema"],
			},
		});
	});

	it("verifies exact session ownership, auth config, account, and scope before execution", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/trs_gmail") && init?.method === "GET") {
				return jsonResponse({
					config: {
						user_id: "polychat:test:user:42",
						toolkits: { enabled: ["gmail"] },
						auth_configs: { gmail: "ac_gmail" },
						connected_accounts: { gmail: ["ca_gmail"] },
						tools: { gmail: { enabled: ["GMAIL_FETCH_EMAILS"] } },
					},
				});
			}
			if (url.endsWith("/trs_gmail/execute")) {
				return jsonResponse({ data: { messages: [] }, error: null, log_id: "log_1" });
			}
			return jsonResponse({});
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeComposioSessionTool({
				env: createEnv(),
				userId: 42,
				sessionId: "trs_gmail",
				provider: gmailProvider(),
				toolSlug: "GMAIL_FETCH_EMAILS",
				authConfigId: "ac_gmail",
				connectedAccountId: "ca_gmail",
				arguments: { query: "invoice" },
			}),
		).resolves.toEqual({ data: { messages: [] }, logId: "log_1" });
		expect(fetchMock).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("deletes a connector session explicitly and treats a missing session as already closed", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(jsonResponse({ error: { message: "not found" } }, 404));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			deleteComposioToolSession({ env: createEnv(), sessionId: "trs_gmail" }),
		).resolves.toBeUndefined();
		await expect(
			deleteComposioToolSession({ env: createEnv(), sessionId: "trs_missing" }),
		).resolves.toBeUndefined();
	});

	it("surfaces scoped API-key permission errors without leaking the upstream payload", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(
					{
						error: {
							slug: "APIKey_InsufficientPermissions",
							message: 'This route requires "sessions" write access, but the key has read access.',
							request_id: "request-safe",
						},
					},
					403,
				),
			),
		);

		await expect(
			createComposioToolSession({
				env: createEnv(),
				userId: 42,
				provider: gmailProvider(),
				connectedAccount: {
					id: "ca_gmail",
					userId: "polychat:test:user:42",
					toolkitSlug: "gmail",
					authConfigId: "ac_gmail",
					status: "ACTIVE",
					createdAt: "now",
					updatedAt: "now",
					isDisabled: false,
				},
				allowedToolSlugs: ["GMAIL_FETCH_EMAILS"],
			}),
		).rejects.toMatchObject({
			message: "Composio API key needs write access for sessions",
			statusCode: 403,
			context: { requestId: "request-safe" },
		});
	});
});
