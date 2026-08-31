import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { performOcr } from ".";

const extractText = vi.hoisted(() => vi.fn());
const resolveOcrInput = vi.hoisted(() => vi.fn());
const requireProjectAccess = vi.hoisted(() => vi.fn());
const requireConversationScope = vi.hoisted(() => vi.fn());
const recordProjectAudit = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/ocr", () => ({
  resolveOcrProviderName: vi.fn().mockResolvedValue("mistral"),
  getOcrProvider: vi.fn(() => ({ extractText })),
}));
vi.mock("./input", () => ({ resolveOcrInput }));
vi.mock("~/services/workspaces/access", () => ({ requireProjectAccess }));
vi.mock("~/services/outputs/access", () => ({ requireConversationScope }));
vi.mock("~/services/audit", () => ({ recordProjectAudit }));

const result = {
  model: "mistral-ocr-4-1",
  outputId: "output-1",
  key: "ocr/projects/project-1/run-1/output.md",
  url: "https://assets.example.test/output/output-1",
  outputFormat: "markdown" as const,
  extractedText: "Extracted text",
  response: {
    model: "mistral-ocr-4-1",
    pages: [],
    usage: { pagesProcessed: 1 },
  },
};

describe("performOcr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveOcrInput.mockResolvedValue({
      document: { type: "document_url", document_url: "data:application/pdf;base64,AQ==" },
      sourceId: "source-1",
    });
    extractText.mockResolvedValue(result);
  });

  it("authorises scope before provider spend and persists source provenance", async () => {
    const attachSources = vi.fn();
    const context = {
      env: {},
      user: { id: 42, plan_id: "pro" },
      repositories: { outputs: { attachSources } },
    } as unknown as ServiceContext;

    await expect(
      performOcr({
        context,
        userId: 42,
        projectId: "project-1",
        conversationId: "conversation-1",
        request: {
          document: { type: "source", source_id: "source-1" },
          table_format: "html",
          include_blocks: true,
        },
      }),
    ).resolves.toEqual(result);

    expect(requireProjectAccess).toHaveBeenCalledWith(context, "project-1");
    expect(requireConversationScope).toHaveBeenCalledWith(
      context,
      42,
      "conversation-1",
      "project-1",
    );
    expect(resolveOcrInput).toHaveBeenCalledWith({
      context,
      userId: 42,
      projectId: "project-1",
      input: { type: "source", source_id: "source-1" },
    });
    expect(extractText).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        projectId: "project-1",
        conversationId: "conversation-1",
        document: expect.objectContaining({ type: "document_url" }),
        table_format: "html",
        include_blocks: true,
      }),
    );
    expect(attachSources).toHaveBeenCalledWith("output-1", ["source-1"]);
    expect(recordProjectAudit).toHaveBeenCalledWith(
      context,
      "project-1",
      expect.objectContaining({ action: "output.created", targetId: "output-1" }),
    );
  });

  it("does not call the provider when project authorisation fails", async () => {
    requireProjectAccess.mockRejectedValueOnce(new Error("no access"));
    const context = { env: {}, user: { id: 42 } } as unknown as ServiceContext;

    await expect(
      performOcr({
        context,
        userId: 42,
        projectId: "project-1",
        request: { document: { type: "source", source_id: "source-1" } },
      }),
    ).rejects.toThrow("no access");
    expect(extractText).not.toHaveBeenCalled();
  });

  it("passes private Output provenance to persistence", async () => {
    resolveOcrInput.mockResolvedValueOnce({
      document: { type: "image_url", image_url: "data:image/png;base64,AQ==" },
      parentOutputId: "output-parent",
    });
    const context = {
      env: {},
      user: { id: 42, plan_id: "pro" },
      repositories: { outputs: { attachSources: vi.fn() } },
    } as unknown as ServiceContext;

    await performOcr({
      context,
      userId: 42,
      request: { document: { type: "output", output_id: "output-parent" } },
    });

    expect(extractText).toHaveBeenCalledWith(
      expect.objectContaining({ parentOutputId: "output-parent" }),
    );
  });
});
