import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, Message } from "~/types";

const mocks = vi.hoisted(() => ({
  enforceImagePolicy: vi.fn<() => Promise<void>>(async () => undefined),
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/modules/generate/application/image-policy", () => ({
  enforceImagePolicy: mocks.enforceImagePolicy,
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getModelConfigByMatchingModel: mocks.getModelConfigByMatchingModel,
}));

import {
  enforceChatImagePolicy,
  screenActivatedImageTool,
  type ChatImagePolicyRequest,
} from "../image-policy";

const TEXT_MODEL = {
  matchingModel: "text",
  provider: "test",
  modalities: { input: ["text"], output: ["text"] },
} as ModelConfigItem;
const IMAGE_MODEL = {
  matchingModel: "image",
  provider: "test",
  modalities: { input: ["text"], output: ["text", "image"] },
} as ModelConfigItem;
const MESSAGES: Message[] = [
  {
    role: "user",
    content: [
      { type: "text", text: "placeholder" },
      { type: "image_url", image_url: { url: "https://example.com/reference.png" } },
    ],
  },
];

function request(overrides: Partial<ChatImagePolicyRequest>): ChatImagePolicyRequest {
  return {
    options: { env: {} as IEnv, completion_id: "completion-1" },
    primaryModelConfig: TEXT_MODEL,
    modelConfigs: [{ model: "text", provider: "test", displayName: "Text" }],
    enabledTools: [],
    messages: MESSAGES,
    messageWithContext: "placeholder",
    ...overrides,
  };
}

describe("enforceChatImagePolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips models that cannot produce images", async () => {
    await enforceChatImagePolicy(request({}));

    expect(mocks.enforceImagePolicy).not.toHaveBeenCalled();
  });

  it("screens the message and attachments for an image model", async () => {
    await enforceChatImagePolicy(
      request({
        primaryModelConfig: IMAGE_MODEL,
        modelConfigs: [{ model: "image", provider: "test", displayName: "Image" }],
      }),
    );

    expect(mocks.enforceImagePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "chat",
        text: "placeholder",
        images: ["https://example.com/reference.png"],
      }),
    );
  });

  it("screens when any model in a multi-model request produces images", async () => {
    mocks.getModelConfigByMatchingModel.mockResolvedValue(IMAGE_MODEL);

    await enforceChatImagePolicy(
      request({
        modelConfigs: [
          { model: "text", provider: "test", displayName: "Text" },
          { model: "image", provider: "test", displayName: "Image" },
        ],
      }),
    );

    expect(mocks.enforceImagePolicy).toHaveBeenCalledTimes(1);
  });

  it("screens when the hosted image tool is enabled on a text model", async () => {
    await enforceChatImagePolicy(
      request({
        primaryModelConfig: { ...TEXT_MODEL, supportsImageGenerationTool: true },
        enabledTools: ["image_generation"],
      }),
    );

    expect(mocks.enforceImagePolicy).toHaveBeenCalledTimes(1);
  });

  it("carries earlier turns and their attachments into the check", async () => {
    await enforceChatImagePolicy(
      request({
        primaryModelConfig: IMAGE_MODEL,
        modelConfigs: [{ model: "image", provider: "test", displayName: "Image" }],
        messages: [
          { role: "system", content: "system placeholder" },
          ...MESSAGES,
          { role: "assistant", content: "assistant placeholder" },
          { role: "user", content: "latest placeholder" },
        ],
        messageWithContext: "latest placeholder",
      }),
    );

    expect(mocks.enforceImagePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "latest placeholder",
        history: [
          { role: "user", text: "placeholder" },
          { role: "assistant", text: "assistant placeholder" },
        ],
        images: ["https://example.com/reference.png"],
      }),
    );
  });
});

describe("screenActivatedImageTool", () => {
  const SUPPORTED = { ...TEXT_MODEL, supportsImageGenerationTool: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves other activated tools unscreened", async () => {
    await expect(
      screenActivatedImageTool(request({ primaryModelConfig: SUPPORTED }), ["web_search"]),
    ).resolves.toEqual(["web_search"]);

    expect(mocks.enforceImagePolicy).not.toHaveBeenCalled();
  });

  it("screens the conversation when the image tool switches on mid-run", async () => {
    await expect(
      screenActivatedImageTool(request({ primaryModelConfig: SUPPORTED }), ["image_generation"]),
    ).resolves.toEqual(["image_generation"]);

    expect(mocks.enforceImagePolicy).toHaveBeenCalledTimes(1);
  });

  it("withholds only the image tool when the check does not pass", async () => {
    mocks.enforceImagePolicy.mockRejectedValueOnce(new Error("Refused"));

    await expect(
      screenActivatedImageTool(request({ primaryModelConfig: SUPPORTED }), [
        "image_generation",
        "web_search",
      ]),
    ).resolves.toEqual(["web_search"]);
  });
});
