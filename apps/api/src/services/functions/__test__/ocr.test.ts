import { beforeEach, describe, expect, it, vi } from "vitest";

import { extract_text_from_document } from "../ocr";

const performOcr = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/retrieval/ocr", () => ({ performOcr }));

const serviceContext = {
  env: {},
  user: { id: 42 },
};

function createContext() {
  return {
    completionId: "completion-1",
    request: {
      context: serviceContext,
      env: serviceContext.env,
      user: serviceContext.user,
      memoryScope: { type: "project", projectId: "project-1" },
      request: { completion_id: "conversation-1" },
    },
  } as never;
}

describe("extract_text_from_document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    performOcr.mockResolvedValue({
      model: "mistral-ocr-4-1",
      outputId: "output-1",
      key: "ocr/output-1/output.md",
      url: "https://assets.example.test/output/output-1",
      outputFormat: "markdown",
      extractedText: "Recognised invoice text",
      response: {
        model: "mistral-ocr-4-1",
        pages: [],
        usage: { pagesProcessed: 2 },
      },
    });
  });

  it("runs private OCR 4 input in the request project and conversation scope", async () => {
    const result = await extract_text_from_document.execute(
      {
        source_id: "source-1",
        model: "mistral-ocr-4-1",
        pages: "0-1",
        include_blocks: true,
        confidence_scores_granularity: "word",
        table_format: "html",
        extract_header: true,
        extract_footer: true,
      },
      createContext(),
    );

    expect(performOcr).toHaveBeenCalledWith({
      context: serviceContext,
      userId: 42,
      projectId: "project-1",
      conversationId: "conversation-1",
      request: expect.objectContaining({
        document: { type: "source", source_id: "source-1" },
        model: "mistral-ocr-4-1",
        pages: "0-1",
        include_blocks: true,
        confidence_scores_granularity: "word",
        table_format: "html",
        extract_header: true,
        extract_footer: true,
      }),
    });
    expect(result).toMatchObject({
      status: "success",
      data: {
        outputId: "output-1",
        usage: { pagesProcessed: 2 },
      },
    });
    expect(result.content).toContain("Recognised invoice text");
  });

  it("rejects ambiguous inputs before starting OCR", async () => {
    await expect(
      extract_text_from_document.execute(
        {
          source_id: "source-1",
          output_id: "output-1",
        },
        createContext(),
      ),
    ).rejects.toThrow("Provide exactly one document_url, image_url, source_id, or output_id");

    expect(performOcr).not.toHaveBeenCalled();
  });
});
