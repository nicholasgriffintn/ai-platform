import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import dynamicAppsRoutes from "../dynamic-apps";
import type { AnonymousUser } from "~/types";

const executeDynamicAppMock = vi.hoisted(() => vi.fn());
const getDynamicAppCatalogMock = vi.hoisted(() => vi.fn());
const getDynamicAppByIdMock = vi.hoisted(() => vi.fn());
const getDynamicAppResponseByIdMock = vi.hoisted(() => vi.fn());
const listDynamicAppResponsesForUserMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/dynamic-apps", () => ({
	executeDynamicApp: executeDynamicAppMock,
	getDynamicAppById: getDynamicAppByIdMock,
	getDynamicAppCatalog: getDynamicAppCatalogMock,
	getDynamicAppResponseById: getDynamicAppResponseByIdMock,
	listDynamicAppResponsesForUser: listDynamicAppResponsesForUserMock,
}));

const anonymousUser: AnonymousUser = {
	id: "anon-123",
	ip_address: "127.0.0.1",
	daily_message_count: 0,
	created_at: "2026-06-04T00:00:00.000Z",
	updated_at: "2026-06-04T00:00:00.000Z",
};

function createApp() {
	const app = new Hono<{
		Variables: {
			anonymousUser: AnonymousUser;
		};
	}>();

	app.use("*", async (c, next) => {
		c.set("anonymousUser", anonymousUser);
		await next();
	});

	app.route("/dynamic-apps", dynamicAppsRoutes);
	return app;
}

describe("dynamic apps routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("allows anonymous users to load the app catalog", async () => {
		getDynamicAppCatalogMock.mockResolvedValue([
			{
				id: "featured-strudel",
				name: "Strudel",
				featured: true,
				kind: "frontend",
				href: "/apps/strudel",
			},
		]);

		const response = await createApp().request(
			new Request("https://api.polychat.test/dynamic-apps"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			apps: [
				{
					id: "featured-strudel",
					name: "Strudel",
					featured: true,
					kind: "frontend",
					href: "/apps/strudel",
				},
			],
		});
		expect(getDynamicAppCatalogMock).toHaveBeenCalledOnce();
	});

	it("allows anonymous users to execute dynamic apps without a persisted user id", async () => {
		executeDynamicAppMock.mockResolvedValue({
			success: true,
			data: {
				message: "ok",
			},
		});

		const response = await createApp().request(
			new Request("https://api.polychat.test/dynamic-apps/web-search/execute", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({ query: "test" }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			success: true,
			data: {
				message: "ok",
			},
		});
		expect(executeDynamicAppMock).toHaveBeenCalledWith(
			"web-search",
			{ query: "test" },
			expect.objectContaining({
				anonymousUser,
				user: undefined,
			}),
		);
	});
});
