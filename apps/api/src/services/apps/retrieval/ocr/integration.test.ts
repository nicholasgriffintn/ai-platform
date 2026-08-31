import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { performOcr } from ".";

const mocks = vi.hoisted(() => ({
  extractText: vi.fn(),
  readPrivateFile: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/ocr", () => ({
  getOcrProvider: vi.fn(() => ({ extractText: mocks.extractText })),
  resolveOcrProviderName: vi.fn().mockResolvedValue("mistral"),
}));

vi.mock("~/lib/storage/read-resource", () => ({
  readPrivateFile: mocks.readPrivateFile,
}));

describe("OCR private-input integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not send a project file to the provider from personal scope", async () => {
    mocks.readPrivateFile.mockResolvedValue({
      record: {
        mime_type: "application/pdf",
        project_id: "project-2",
      },
      object: {
        size: 1,
        arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1]).buffer),
      },
    });
    const context = {
      env: {},
      user: { id: 42, plan_id: "pro" },
    } as unknown as ServiceContext;

    await expect(
      performOcr({
        context,
        userId: 42,
        request: {
          document: { type: "source", source_id: "source-1" },
        },
      }),
    ).rejects.toThrow("OCR input and output must use the same project scope");

    expect(mocks.extractText).not.toHaveBeenCalled();
  });
});
