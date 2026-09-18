import { describe, expect, it } from "vitest";

import {
  isBedrockMantleRemoteModel,
  remoteModelBelongsToProvider,
  resolveRemoteModelProvider,
} from "./provider-routing.mjs";

const mantleOverride = {
  npm: "@ai-sdk/amazon-bedrock/mantle",
  api: "https://bedrock-mantle.${AWS_REGION}.api.aws/v1",
  shape: "responses",
};

describe("bedrock mantle routing", () => {
  it("detects mantle models from the models.dev provider override", () => {
    expect(isBedrockMantleRemoteModel({ provider: mantleOverride })).toBe(true);
    expect(
      isBedrockMantleRemoteModel({
        provider: { api: "https://bedrock-mantle.us-east-1.api.aws/openai/v1", shape: "responses" },
      }),
    ).toBe(true);
    expect(
      isBedrockMantleRemoteModel({
        provider: { npm: "@ai-sdk/amazon-bedrock/mantle", shape: "chat" },
      }),
    ).toBe(true);
    expect(
      isBedrockMantleRemoteModel({
        provider: { api: "https://bedrock-mantle.us-east-1.api.aws/v1" },
      }),
    ).toBe(true);
  });

  it("ignores runtime endpoints and unrelated shapes", () => {
    expect(isBedrockMantleRemoteModel(undefined)).toBe(false);
    expect(isBedrockMantleRemoteModel({})).toBe(false);
    expect(isBedrockMantleRemoteModel({ provider: "responses" })).toBe(false);
    expect(
      isBedrockMantleRemoteModel({
        provider: {
          api: "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1",
          shape: "responses",
        },
      }),
    ).toBe(false);
  });

  it("routes amazon-bedrock models to their catalogue provider", () => {
    const mantle = { provider: mantleOverride };
    const runtime = { id: "openai.gpt-oss-120b" };

    expect(resolveRemoteModelProvider("amazon-bedrock", mantle)).toBe("bedrock-mantle");
    expect(resolveRemoteModelProvider("amazon-bedrock", runtime)).toBe("bedrock");
    expect(resolveRemoteModelProvider("openai", mantle)).toBeNull();
    expect(remoteModelBelongsToProvider("amazon-bedrock", "bedrock", runtime)).toBe(true);
    expect(remoteModelBelongsToProvider("amazon-bedrock", "bedrock-mantle", runtime)).toBe(false);
    expect(remoteModelBelongsToProvider("openai", "openai", mantle)).toBe(true);
  });
});
