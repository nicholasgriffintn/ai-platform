import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { IUser } from "~/types";
import { AssistantError, handleAIServiceError } from "~/utils/errors";
import { requirePlan, requireUser } from "../requirePlan";

type Variables = {
	user?: IUser;
};

function createUser(planId: string | null): IUser {
	return {
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
		created_at: "2026-06-07T00:00:00.000Z",
		updated_at: "2026-06-07T00:00:00.000Z",
		setup_at: null,
		terms_accepted_at: null,
		plan_id: planId,
	};
}

function createApp(user?: IUser) {
	const app = new Hono<{ Variables: Variables }>();
	app.onError((error) => {
		if (error instanceof AssistantError) {
			return handleAIServiceError(error);
		}
		throw error;
	});
	app.use("*", async (context, next) => {
		if (user) {
			context.set("user", user);
		}
		await next();
	});
	return app;
}

describe("requirePlan", () => {
	it("allows users on the required plan", async () => {
		const app = createApp(createUser("pro"));
		app.get("/pro", requirePlan("pro"), (context) => context.json({ ok: true }));

		const response = await app.request("/pro");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true });
	});

	it("rejects anonymous requests before checking plan state", async () => {
		const app = createApp();
		app.get("/pro", requirePlan("pro"), (context) => context.json({ ok: true }));

		const response = await app.request("/pro");

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: "Authentication failed. Please check your credentials.",
		});
	});

	it("rejects users whose current plan does not satisfy the required plan", async () => {
		const app = createApp(createUser(null));
		app.get("/pro", requirePlan("pro"), (context) => context.json({ ok: true }));

		const response = await app.request("/pro");

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			error: "An internal error occurred. Please try again later.",
		});
	});
});

describe("requireUser", () => {
	it("allows authenticated users", async () => {
		const app = createApp(createUser("free"));
		app.get("/me", requireUser(), (context) => context.json({ ok: true }));

		const response = await app.request("/me");

		expect(response.status).toBe(200);
	});

	it("rejects unauthenticated requests", async () => {
		const app = createApp();
		app.get("/me", requireUser(), (context) => context.json({ ok: true }));

		const response = await app.request("/me");

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toMatchObject({
			error: "Authentication failed. Please check your credentials.",
		});
	});

	it("uses authorisation errors for plan mismatches", async () => {
		const app = createApp(createUser("free"));
		app.get("/enterprise", requirePlan("enterprise"), (context) => context.json({ ok: true }));

		const response = await app.request("/enterprise");
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).not.toHaveProperty("requestId");
	});
});
