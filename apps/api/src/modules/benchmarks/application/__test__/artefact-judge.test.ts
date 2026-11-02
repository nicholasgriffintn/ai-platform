import { getBenchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { judgeBenchmarkArtefact } from "../artefact-judge";

const mocks = vi.hoisted(() => ({
  model: vi.fn(async () => ({ model: "chosen-judge", provider: "mistral", effort: "low" })),
  complete: vi.fn(async () => ({ text: '{"score":5}' })),
}));

vi.mock("~/infrastructure/ai", () => ({ ai: { complete: mocks.complete } }));
vi.mock("~/modules/models/application/resolve", () => ({ getAuxiliaryModel: mocks.model }));

const env: IEnv = {
  AI: undefined,
  VECTOR_DB: undefined,
  DB: undefined,
  CACHE: undefined,
  ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET_NAME: "",
  ACCOUNT_ID: "",
  ASSETS_BUCKET_ACCESS_KEY_ID: "",
  ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
};
const user: IUser = {
  id: 7,
  name: null,
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
};
const benchmark = getBenchmark("hamster-wheel");

describe("benchmark judge model choices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves scoped choices and invokes the model with the same user", async () => {
    const score = await judgeBenchmarkArtefact(
      { env, user, workspaceId: "workspace-1" },
      benchmark,
      benchmark.itemIds[0],
      "<html>Example</html>",
    );

    expect(score).toBe(1);
    expect(mocks.model).toHaveBeenCalledWith(env, user, { workspaceId: "workspace-1" });
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ user, model: "chosen-judge", provider: "mistral" }),
    );
  });

  it("retains the gate score if the configured judge fails", async () => {
    mocks.complete.mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(
      judgeBenchmarkArtefact({ env, user }, benchmark, benchmark.itemIds[0], "<html/>"),
    ).resolves.toBeNull();
  });
});
