import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import dynamicAppRoutes from "../dynamic-apps";
import type { IUser } from "~/types";

const executeDynamicAppMock = vi.hoisted(() => vi.fn());
const getDynamicAppByIdMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/dynamic-apps", async () => {
	const actual = await vi.importActual<typeof import("~/services/dynamic-apps")>(
		"~/services/dynamic-apps",
	);

	return {
		...actual,
		executeDynamicApp: executeDynamicAppMock,
		getDynamicAppById: getDynamicAppByIdMock,
	};
});

const testUser = {
	id: 42,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-06-02T00:00:00.000Z",
	updated_at: "2026-06-02T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "free",
} satisfies IUser;

function createApp(user: IUser = testUser) {
	const app = new Hono();

	app.use("/dynamic-apps/*", async (context, next) => {
		(context as any).set("user", user);
		(context as unknown as { env: Record<string, unknown> }).env = { TEST_ENV: true };
		await next();
	});

	app.route("/dynamic-apps", dynamicAppRoutes);
	return app;
}

describe("dynamic-apps routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects non-object payloads for execute endpoint", async () => {
		const response = await createApp().request(
			new Request("https://api.polychat.test/dynamic-apps/research/execute", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(["not", "an", "object"]),
			}),
		);

		expect(response.status).toBe(400);
		expect(executeDynamicAppMock).not.toHaveBeenCalled();
	});

	it("passes validated request body to dynamic app execution", async () => {
		getDynamicAppByIdMock.mockResolvedValue({
			id: "research",
			name: "Research",
			formSchema: { title: "Research", fields: [] },
			responseSchema: { type: "markdown", display: { template: "default" } },
		} as any);
		executeDynamicAppMock.mockResolvedValue({
			success: true,
			response_id: "response-123",
			data: {
				message: "Successfully executed Research app",
				timestamp: "2026-06-02T10:00:00.000Z",
				input: { query: "contract drift" },
				result: { summary: "ok" },
			},
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/dynamic-apps/research/execute", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ query: "contract drift" }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			success: true,
			response_id: "response-123",
			data: {
				message: "Successfully executed Research app",
				timestamp: "2026-06-02T10:00:00.000Z",
				input: { query: "contract drift" },
				result: { summary: "ok" },
			},
		});

		expect(getDynamicAppByIdMock).toHaveBeenCalledWith("research");
		expect(executeDynamicAppMock).toHaveBeenCalledWith(
			"research",
			{ query: "contract drift" },
			expect.objectContaining({
				app_url: "https://api.polychat.test",
				request: {
					completion_id: expect.any(String),
					input: "dynamic-app-execution",
					date: expect.any(String),
					platform: "dynamic-apps",
				},
				user: testUser,
			}),
		);
	});
});
