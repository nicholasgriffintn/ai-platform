import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ConversationModelSelection } from "~/modules/responses/application/engine/policy/project-model-tier";
import type { CoreChatOptions, IEnv, Message } from "~/types";

import { ModelConfigValidator } from "../ModelConfigValidator";

const mocks = vi.hoisted(() => ({
  storedSelection: vi.fn<() => Promise<ConversationModelSelection>>(),
  selectModels: vi.fn(async () => ({ models: ["selected-model"] })),
}));

vi.mock("~/modules/models/application/access", () => ({ selectModels: mocks.selectModels }));
vi.mock("~/modules/models/application/request-config", () => ({
  resolveRequestModelConfig: async () => ({ matchingModel: "selected-model", provider: "mistral" }),
}));
vi.mock("~/modules/responses/application/engine/policy/project-model-governance", () => ({
  applyProjectModelGovernance: async (_options: unknown, selection: { models: string[] }) =>
    selection,
}));
vi.mock("~/modules/responses/application/engine/policy/project-model-tier", () => ({
  resolveConversationModelSelection: mocks.storedSelection,
  resolveProjectModelTier: async () => "high",
}));
vi.mock("~/modules/user/application/request-settings", () => ({
  getRequestUserSettings: async () => ({ default_model_id: "account-model" }),
}));

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

describe("request model preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storedSelection.mockResolvedValue({ conversationExists: true });
  });

  it.each([
    {
      name: "uses the account default in a pre-created thread without a saved selection",
      stored: { conversationExists: true },
      request: {},
      expected: "account-model",
    },
    {
      name: "keeps a saved model when the request omits a selection",
      stored: { conversationExists: true, modelId: "saved-model" },
      request: {},
      expected: "saved-model",
    },
    {
      name: "uses an explicitly requested tier instead of a saved model",
      stored: { conversationExists: true, modelId: "saved-model" },
      request: { model_tier: "high" },
      expected: undefined,
    },
    {
      name: "keeps a saved tier instead of applying the account model",
      stored: { conversationExists: true, modelId: "previous-tier-model", modelTier: "high" },
      request: {},
      expected: undefined,
    },
    {
      name: "keeps an explicitly requested model over saved and account defaults",
      stored: { conversationExists: true, modelId: "saved-model" },
      request: { model: "requested-model" },
      expected: "requested-model",
    },
  ] satisfies {
    name: string;
    stored: ConversationModelSelection;
    request: Partial<CoreChatOptions>;
    expected: string | undefined;
  }[])("$name", async ({ stored, request, expected }) => {
    mocks.storedSelection.mockResolvedValue(stored);
    const lastMessage: Message = { role: "user", content: "Hello" };
    const result = await new ModelConfigValidator().validate(
      { env, context: createServiceContext({ env }), ...request },
      { sanitisedMessages: [lastMessage], lastMessage },
    );

    expect(result.validation.isValid).toBe(true);
    expect(mocks.selectModels).toHaveBeenCalledWith(
      expect.objectContaining({ requestedModel: expected }),
    );
  });
});
