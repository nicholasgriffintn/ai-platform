import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { validateSlackInstallation } from "~/modules/channels/application/slack-installation";
import type { IEnv } from "~/types";

import { channelTestEnvironment } from "./channels";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;

beforeAll(async () => {
  env = channelTestEnvironment(await runtime.getD1Database("DB"), {
    SLACK_BOT_TOKEN: "test-token",
    SLACK_SIGNING_SECRET: "test-signing",
    SLACK_BOT_USER_ID: "U123",
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => runtime.dispose());

describe("Slack installation authority", () => {
  it("verifies the exact installation before accepting a binding", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ok: true, team_id: "T123", user_id: "U123" }),
    );

    vi.stubGlobal("fetch", fetcher);
    await expect(validateSlackInstallation(env, "T123")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      "https://slack.com/api/auth.test",
      expect.objectContaining({
        redirect: "error",
        headers: { authorization: "Bearer test-token" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    { ok: true, team_id: "T999", user_id: "U123" },
    { ok: true, team_id: "T123", user_id: "U999" },
    { ok: false, error: "private details" },
  ])("rejects mismatched or unverified bot installations", async (body) => {
    vi.stubGlobal("fetch", async () => Response.json(body));
    await expect(validateSlackInstallation(env, "T123")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("sanitises transport failures and oversized responses", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("private credential details");
    });
    await expect(validateSlackInstallation(env, "T123")).rejects.toMatchObject({
      message: "The Slack installation could not be verified",
      statusCode: 503,
    });
    vi.stubGlobal("fetch", async () => new Response("x".repeat(8193)));
    await expect(validateSlackInstallation(env, "T123")).rejects.toMatchObject({
      message: "The Slack installation could not be verified",
      statusCode: 503,
    });
  });
});
