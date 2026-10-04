import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { decide } from "../decide";

const runDecision = vi.hoisted(() => vi.fn());

vi.mock("~/modules/decisions/application/decide", () => ({ decide: runDecision }));

const env: IEnv = {
  get DB(): never {
    throw new Error("Unexpected database access");
  },
  get AI(): never {
    throw new Error("Unexpected inference access");
  },
  get ANALYTICS(): never {
    throw new Error("Unexpected analytics access");
  },
  get VECTOR_DB(): never {
    throw new Error("Unexpected vector access");
  },
  get CACHE(): never {
    throw new Error("Unexpected cache access");
  },
  ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET_NAME: "test-private-assets",
  ACCOUNT_ID: "test-account",
  ASSETS_BUCKET_ACCESS_KEY_ID: "",
  ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
};
const user: IUser = {
  id: 42,
  email: "test@example.com",
  name: null,
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-10-03T00:00:00.000Z",
  updated_at: "2026-10-03T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
};
const context = { completionId: "decision-run", request: { env, user } };
const questions = { urgent: { type: "noul", instructions: "Is this urgent?" } } as const;

describe("Decide tool model selection", () => {
  beforeEach(() => {
    runDecision.mockReset();
    runDecision.mockResolvedValue({
      provider: "workers-ai",
      model: "@cf/cloudflare/clef",
      answers: { urgent: { type: "noul", noul: 0.97 } },
      usage: { input_tokens: 120, output_tokens: 0 },
    });
  });

  it.each(["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"])(
    "passes the submitted %s selection through to decision inference",
    async (model) => {
      const args = decide.inputSchema.parse({ model, state: "Checkout is down", questions });
      const response = await decide.execute(args, context);

      const call = runDecision.mock.calls[0]?.[0];

      expect(call.env).toBe(env);
      expect(call.user).toBe(user);
      expect(call.completionId).toBe("decision-run");
      expect(call.request).toEqual({ model, state: "Checkout is down", questions });
      expect(response).toMatchObject({
        status: "success",
        data: { provider: "workers-ai", answers: { urgent: { type: "noul", noul: 0.97 } } },
      });
    },
  );

  it.each(["auto", undefined])("preserves automatic selection for %s", async (model) => {
    await decide.execute({ model, state: "x", questions }, context);

    expect(runDecision).toHaveBeenCalledWith(
      expect.objectContaining({ request: { model: undefined, state: "x", questions } }),
    );
  });

  it("does not start inference without a signed-in account", async () => {
    const response = await decide.execute(
      { state: "x", questions, model: "@cf/cloudflare/clef" },
      { completionId: "decision-run", request: { env } },
    );

    expect(response.status).toBe("error");
    expect(runDecision).not.toHaveBeenCalled();
  });
});
