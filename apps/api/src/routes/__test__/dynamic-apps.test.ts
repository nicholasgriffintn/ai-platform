import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import dynamicAppsRoutes from "../dynamic-apps";
import type { AnonymousUser } from "~/types";
import type { IUser } from "~/types";

const executeProjectDynamicAppMock = vi.hoisted(() => vi.fn());
const getDynamicAppCatalogMock = vi.hoisted(() => vi.fn());
const getDynamicAppByIdMock = vi.hoisted(() => vi.fn());
const getDynamicAppResponseByIdMock = vi.hoisted(() => vi.fn());
const listDynamicAppResponsesForUserMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/dynamic-apps", () => ({
	executeProjectDynamicApp: executeProjectDynamicAppMock,
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

const user: IUser = {
	id: 42,
	name: "Project member",
	avatar_url: null,
	email: "member@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-06-04T00:00:00.000Z",
	updated_at: "2026-06-04T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

function createApp({ authenticated = false } = {}) {
	const app = new Hono<{
		Variables: {
			anonymousUser: AnonymousUser;
			user: IUser;
		};
	}>();

	app.use("*", async (c, next) => {
		c.set("anonymousUser", anonymousUser);
		if (authenticated) {
			c.set("user", user);
		}
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

	it("executes dynamic apps inside an authenticated project", async () => {
		executeProjectDynamicAppMock.mockResolvedValue({
			success: true,
			data: {
				message: "ok",
			},
		});

		const response = await createApp({ authenticated: true }).request(
			new Request("https://api.polychat.test/dynamic-apps/web-search/execute?projectId=project-1", {
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
		expect(executeProjectDynamicAppMock).toHaveBeenCalledWith(
			"web-search",
			{ query: "test" },
			expect.objectContaining({
				user: expect.objectContaining({ id: 42 }),
			}),
			"project-1",
		);
	});
});
