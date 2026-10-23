import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AnonymousUser, User } from "~/types";

import { requireAgeCheck } from "../ageGate";

type Principal = { user?: Partial<User>; anonymousUser?: Partial<AnonymousUser> };

function send(principal: Principal, enabled?: string) {
  const app = new Hono<{ Variables: Principal }>();

  app.use("*", async (c, next) => {
    c.set("user", principal.user);
    c.set("anonymousUser", principal.anonymousUser);
    await next();
  });
  app.post("/responses", requireAgeCheck, (c) => c.text("ok"));
  app.onError((error, c) => c.text(error.message, error instanceof AssistantError ? 403 : 500));

  return app.request("/responses", { method: "POST" }, { AGE_GATE_ENABLED: enabled });
}

describe("requireAgeCheck", () => {
  it("refuses messages until an adult age check is recorded", async () => {
    expect((await send({ user: { id: 1, age_check: null } })).status).toBe(403);
    expect((await send({ user: { id: 1, age_check: "under_age" } })).status).toBe(403);
    expect((await send({ user: { id: 1, age_check: "adult" } })).status).toBe(200);
  });

  it("applies to anonymous sessions too", async () => {
    expect((await send({ anonymousUser: { id: "a", age_check: null } })).status).toBe(403);
    expect((await send({ anonymousUser: { id: "a", age_check: "adult" } })).status).toBe(200);
  });

  it("does nothing when switched off", async () => {
    expect((await send({ user: { id: 1, age_check: "under_age" } }, "false")).status).toBe(200);
  });
});
