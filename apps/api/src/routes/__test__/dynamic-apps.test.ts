import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import dynamicApps from "../dynamic-apps";
import type { AppSchema } from "~/types/app-schema";
import { registerDynamicApp } from "~/services/dynamic-apps";

const executeDynamicApp = vi.hoisted(() => vi.fn());
const getServiceContextMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/dynamic-apps", async () => {
	const actual = await vi.importActual("~/services/dynamic-apps");
	return {
		...actual,
		executeDynamicApp,
	};
});

vi.mock("~/lib/context/serviceContext", () => ({
	getServiceContext: getServiceContextMock,
}));

beforeEach(() => {
	getServiceContextMock.mockReturnValue({} as never);
});

const baseApp: Omit<AppSchema, "id"> = {
	name: "Dynamic App",
	description: "Validation coverage",
	formSchema: {
		steps: [
			{
				id: "details",
				title: "Details",
				fields: [
					{
						id: "query",
						type: "text",
						label: "Query",
						required: true,
					},
				],
			},
		],
	},
	responseSchema: {
		type: "json",
		display: {},
	},
};

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
} satisfies {
	id: number;
	name: string | null;
	avatar_url: string | null;
	email: string | null;
	github_username: string | null;
	company: string | null;
	site: string | null;
	location: string | null;
	bio: string | null;
	twitter_username: string | null;
	created_at: string;
	updated_at: string;
	setup_at: string | null;
	terms_accepted_at: string | null;
	plan_id: string;
};

let appSequence = 0;

function createApp() {
	const app = new Hono();
	app.use("/dynamic-apps/*", async (c, next) => {
		(c as unknown as { set: (key: string, value: unknown) => void }).set("user", testUser);
		await next();
	});
	app.route("/dynamic-apps", dynamicApps);
	return app;
}

function registerTestApp() {
	const appId = `dynamic-app-route-${++appSequence}`;
	registerDynamicApp({
		...baseApp,
		id: appId,
	});

	return appId;
}

describe("dynamic-apps execute", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 400 for non-object execute body", async () => {
		const appId = registerTestApp();

		const response = await createApp().request(
			new Request(`https://api.polychat.test/dynamic-apps/${appId}/execute`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify("not-an-object"),
			}),
		);

		expect(response.status).toBe(400);
		expect(executeDynamicApp).not.toHaveBeenCalled();
	});

	it("passes validated form data through to executeDynamicApp", async () => {
		const appId = registerTestApp();
		const formData = { query: "contract drift" };

		executeDynamicApp.mockResolvedValue({
			success: true,
			response_id: "response-123",
			data: {
				message: "Executed",
				timestamp: "2026-06-02T12:00:00.000Z",
				input: formData,
				result: { success: true },
			},
		});

		const response = await createApp().request(
			new Request(`https://api.polychat.test/dynamic-apps/${appId}/execute`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(formData),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			response_id: "response-123",
			data: {
				message: "Executed",
				timestamp: "2026-06-02T12:00:00.000Z",
				input: formData,
				result: { success: true },
			},
		});

		expect(executeDynamicApp).toHaveBeenCalledWith(
			appId,
			formData,
			expect.objectContaining({
				app_url: "https://api.polychat.test",
				user: testUser,
				request: expect.objectContaining({
					input: "dynamic-app-execution",
					platform: "dynamic-apps",
				}),
			}),
		);
	});
});
