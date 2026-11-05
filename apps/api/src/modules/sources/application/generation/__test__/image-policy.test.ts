import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
  describePicture: vi.fn(async () => "placeholder description"),
  enforceImagePolicy: vi.fn(),
  getModelConfigByModel: vi.fn(),
  getResponse: vi.fn(),
  requireSystemModel: vi.fn(async () => ({ id: "repaint", model: "repaint", provider: "test" })),
  screenGeneratedImage: vi.fn(),
  storeKnowledgeFile: vi.fn(async () => ({ source: { id: "sketch" } })),
}));

vi.mock("~/infrastructure/providers/capabilities/chat", () => ({
  getChatProvider: () => ({ getResponse: mocks.getResponse }),
}));
vi.mock("~/modules/generate/application/image-policy", () => ({
  enforceImagePolicy: mocks.enforceImagePolicy,
}));
vi.mock("~/modules/generate/application/image-policy-classifier", () => ({
  screenGeneratedImage: mocks.screenGeneratedImage,
}));
vi.mock("~/modules/generate/application/vision", () => ({
  describePicture: mocks.describePicture,
}));
vi.mock("~/modules/knowledge/application/intake/file", () => ({
  fileKnowledgeSource: vi.fn(),
  storeKnowledgeFile: mocks.storeKnowledgeFile,
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getModelConfigByModel: mocks.getModelConfigByModel,
  requireSystemModel: mocks.requireSystemModel,
}));
vi.mock("~/modules/sources/application/sources", () => ({ getSource: vi.fn() }));
vi.mock("@ngriffin_uk/polychat-utility-server/multipart-input", () => ({
  buildMultipartInput: async () => ({ multipart: {} }),
}));

import { paintDrawing } from "../drawing/create";
import { startModelGeneration } from "../execute";

const CONTEXT = {
  env: {} as IEnv,
  requireUser: () => ({ id: 4 }),
} as unknown as ServiceContext;

function start() {
  return startModelGeneration({
    context: CONTEXT,
    modelId: "model",
    input: { prompt: "placeholder", image: "https://example.com/reference.png" },
    generation: { type: "model" },
  });
}

describe("image policy on source generations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceImagePolicy.mockRejectedValue(new Error("Refused"));
  });

  it("stops a refused model run before the provider", async () => {
    mocks.getModelConfigByModel.mockResolvedValue({
      matchingModel: "model",
      modalities: { input: ["text", "image"], output: ["image"] },
    });

    await expect(start()).rejects.toThrow("Refused");

    expect(mocks.enforceImagePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "placeholder",
        images: ["https://example.com/reference.png"],
      }),
    );
    expect(mocks.getResponse).not.toHaveBeenCalled();
  });

  it("screens a model whose output is not declared", async () => {
    mocks.getModelConfigByModel.mockResolvedValue({ matchingModel: "model" });

    await expect(start()).rejects.toThrow("Refused");
  });

  it("leaves audio models out of the image check", async () => {
    mocks.getModelConfigByModel.mockResolvedValue({
      matchingModel: "model",
      modalities: { input: ["text"], output: ["audio"] },
    });
    mocks.getResponse.mockRejectedValue(new Error("Reached provider"));

    await expect(start()).rejects.toThrow("Reached provider");

    expect(mocks.enforceImagePolicy).not.toHaveBeenCalled();
  });

  it("keeps a refused sketch out of storage", async () => {
    await expect(
      paintDrawing(CONTEXT, new Blob(["sketch"], { type: "image/png" })),
    ).rejects.toThrow("Refused");

    expect(mocks.storeKnowledgeFile).not.toHaveBeenCalled();
  });

  it("keeps a refused painting out of storage", async () => {
    mocks.enforceImagePolicy.mockResolvedValue(undefined);
    mocks.screenGeneratedImage.mockRejectedValue(new Error("Refused"));
    const context = {
      ...CONTEXT,
      env: { AI: { run: async () => ({ image: "AAAA" }) } },
    } as unknown as ServiceContext;

    await expect(
      paintDrawing(context, new Blob(["sketch"], { type: "image/png" })),
    ).rejects.toThrow("Refused");

    expect(mocks.storeKnowledgeFile).toHaveBeenCalledTimes(1);
    expect(mocks.storeKnowledgeFile).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ origin: "upload" }),
    );
  });
});
