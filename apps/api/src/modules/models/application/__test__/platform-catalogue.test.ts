import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { selectModels } from "~/modules/chat/application/policy/model-access";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { databaseTestEnvironment } from "~/test-utils/environment";
import type { IEnv, IUser } from "~/types";

import { listModels } from "../index";

const models: ModelConfig = {
  "alias:production": {
    id: "deployment:primary",
    matchingModel: "deployment:primary",
    name: "Production",
    provider: "polychat-deployment",
    modalities: { input: ["text"], output: ["text"] },
  },
};

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  getModels: () => ({}),
  getFreeModels: () => ({}),
}));
vi.mock("~/modules/model-serving/application/chat-models", () => ({
  listPlatformChatModels: async () => models,
  findPlatformChatModel: vi.fn(),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;
const user: IUser = {
  id: 1,
  plan_id: "pro",
  email: "member@example.test",
  name: "Member",
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
  setup_at: null,
  terms_accepted_at: null,
};

beforeAll(async () => {
  env = databaseTestEnvironment(await runtime.getD1Database("DB"));
  vi.spyOn(UserSettingsRepository.prototype, "getUserProviderSettings").mockResolvedValue([]);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await runtime.dispose();
});

describe("workspace aliases in Chat", () => {
  it("includes accessible aliases in the main model picker", async () => {
    expect(await listModels(env, user)).toHaveProperty(
      "alias:production",
      expect.objectContaining({ isExecutable: true }),
    );
  });

  it("accepts an explicit alias through the same account access check as catalogue models", async () => {
    await expect(
      selectModels({
        env,
        user,
        attachments: [],
        tier: "medium",
        requestedModel: "alias:production",
      }),
    ).resolves.toEqual({ models: ["alias:production"] });
  });
});
