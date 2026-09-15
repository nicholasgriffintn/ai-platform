import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatCompletionParameters, IEnv } from "~/types";

import { BedrockMantleProvider } from "./bedrock-mantle";

vi.mock("~/lib/providers/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

import { getModelConfigByMatchingModel } from "~/lib/providers/models";

const modelConfigLookup = vi.mocked(getModelConfigByMatchingModel);

class TestBedrockMantleProvider extends BedrockMantleProvider {
  endpointFor(params: ChatCompletionParameters) {
    return this.getEndpoint(params);
  }
}

const provider = new TestBedrockMantleProvider();

function requestFor(overrides: Partial<ChatCompletionParameters> = {}): ChatCompletionParameters {
  return {
    env: Object.assign(Object.create(null), {
      BEDROCK_MANTLE_AWS_REGION: "eu-west-1",
    }) as IEnv,
    provider: "bedrock-mantle",
    messages: [{ role: "user", content: "Plan the migration." }],
    disable_functions: true,
    stream: false,
    ...overrides,
  };
}

function modelConfigFor(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "openai.gpt-oss-120b",
    provider: "bedrock-mantle",
    apiShape: "responses",
    apiBaseUrl: "https://bedrock-mantle.${AWS_REGION}.api.aws/v1",
    supportsToolCalls: false,
    ...overrides,
  };
}

beforeEach(() => {
  modelConfigLookup.mockReset();
});

describe("BedrockMantleProvider shape handling", () => {
  it("substitutes the region into the responses endpoint from the catalogue", async () => {
    modelConfigLookup.mockResolvedValue(modelConfigFor());

    await expect(provider.endpointFor(requestFor({ model: "openai.gpt-oss-120b" }))).resolves.toBe(
      "https://bedrock-mantle.eu-west-1.api.aws/v1/responses",
    );
  });

  it("uses the model's own api base url when it differs from the provider default", async () => {
    modelConfigLookup.mockResolvedValue(
      modelConfigFor({
        matchingModel: "openai.gpt-5.5",
        apiBaseUrl: "https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1",
      }),
    );

    await expect(provider.endpointFor(requestFor({ model: "openai.gpt-5.5" }))).resolves.toBe(
      "https://bedrock-mantle.eu-west-1.api.aws/openai/v1/responses",
    );
  });

  it("builds a responses body when the catalogue declares the responses shape", async () => {
    modelConfigLookup.mockResolvedValue(modelConfigFor());
    const body = await provider.mapParameters(requestFor({ model: "openai.gpt-oss-120b" }));

    expect(body.model).toBe("openai.gpt-oss-120b");
    expect(body).toHaveProperty("input");
    expect(body).not.toHaveProperty("messages");
  });

  it("falls back to chat completions when the catalogue declares the chat shape", async () => {
    modelConfigLookup.mockResolvedValue(
      modelConfigFor({
        matchingModel: "openai.chat-model",
        apiShape: "chat",
        apiBaseUrl: "https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1",
      }),
    );

    await expect(provider.endpointFor(requestFor({ model: "openai.chat-model" }))).resolves.toBe(
      "https://bedrock-mantle.eu-west-1.api.aws/openai/v1/chat/completions",
    );
    const body = await provider.mapParameters(requestFor({ model: "openai.chat-model" }));

    expect(body.model).toBe("openai.chat-model");
    expect(body).toHaveProperty("messages");
    expect(body).not.toHaveProperty("input");
  });

  it("rejects a shape the provider cannot execute", async () => {
    modelConfigLookup.mockResolvedValue(modelConfigFor({ apiShape: "messages" }));

    await expect(
      provider.endpointFor(requestFor({ model: "openai.gpt-oss-120b" })),
    ).rejects.toThrow("Unsupported Bedrock Mantle API shape: messages");
  });
});
