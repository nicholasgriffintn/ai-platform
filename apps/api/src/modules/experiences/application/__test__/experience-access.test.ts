import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { handleAIServiceError } from "~/infrastructure/errors";
import { requireExperience } from "~/modules/experiences/api/access";
import type { IUser } from "~/types";

function createUser(planId: string | null): IUser {
  return {
    id: 7,
    name: "Resident",
    avatar_url: null,
    email: "resident@example.com",
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-11-07T00:00:00.000Z",
    updated_at: "2026-11-07T00:00:00.000Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: planId,
  };
}

function appFor(user?: IUser) {
  const app = new Hono<{ Variables: { user?: IUser } }>();

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
  app.get("/app", requireExperience("featured-polis"), (context) => context.json({ ok: true }));

  return app;
}

describe("app access", () => {
  it("opens apps to Pro accounts", async () => {
    const response = await appFor(createUser("pro")).request("/app");

    expect(response.status).toBe(200);
  });

  it("keeps apps closed to free and signed-out users", async () => {
    const free = await appFor(createUser("free")).request("/app");
    const signedOut = await appFor().request("/app");

    expect(free.status).toBe(403);
    expect(signedOut.status).toBe(401);
  });
});
