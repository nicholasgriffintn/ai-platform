import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { MistralOcrProvider } from "./MistralOcrProvider";

const mocks = vi.hoisted(() => ({
  fetchAIResponse: vi.fn(),
  persistOcrOutput: vi.fn(),
  resolveModelConfig: vi.fn(),
  resolveProviderApiKey: vi.fn(),
}));

vi.mock("~/lib/providers/lib/fetch", () => ({
  fetchAIResponse: mocks.fetchAIResponse,
}));

vi.mock("~/lib/providers/models", () => ({
  resolveModelConfig: mocks.resolveModelConfig,
}));

vi.mock("~/lib/providers/utils/apiKeys", () => ({
  hasUserProviderApiKey: vi.fn(),
  resolveProviderApiKey: mocks.resolveProviderApiKey,
}));

vi.mock("../format", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../format")>()),
  persistOcrOutput: mocks.persistOcrOutput,
}));

const env = {
  AI_GATEWAY_TOKEN: "gateway-token",
} as IEnv;

const user = {
  id: 42,
  plan_id: "pro",
} as IUser;

describe("MistralOcrProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveModelConfig.mockResolvedValue({
      matchingModel: "mistral-ocr-4-1",
      name: "Mistral OCR 4.1",
      strengths: ["ocr"],
    });
    mocks.resolveProviderApiKey.mockResolvedValue("mistral-key");
    mocks.fetchAIResponse.mockResolvedValue({
      model: "mistral-ocr-4-1",
      pages: [],
      usage_info: { pages_processed: 0 },
    });
    mocks.persistOcrOutput.mockResolvedValue({
      outputId: "output-1",
      key: "ocr/request-1/output.md",
      url: "https://assets.example.com/output/output-1",
      outputFormat: "markdown",
    });
  });

  it("sends the current OCR 4 request contract without local storage metadata", async () => {
    await new MistralOcrProvider().extractText({
      env,
      user,
      id: "request-1",
      document: {
        type: "document_url",
        document_url: "https://example.com/report.pdf",
        document_name: "report.pdf",
      },
      pages: "0,2-4",
      include_image_base64: false,
      image_limit: 3,
      image_min_size: 64,
      include_blocks: true,
      confidence_scores_granularity: "block",
      table_format: "html",
      extract_header: true,
      extract_footer: true,
      document_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "report",
          schema: { type: "object", properties: { title: { type: "string" } } },
          strict: true,
        },
      },
      document_annotation_prompt: "Extract the report title",
      bbox_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "figure",
          schema: { type: "object", properties: { kind: { type: "string" } } },
        },
      },
    });

    expect(mocks.fetchAIResponse).toHaveBeenCalledOnce();
    expect(mocks.fetchAIResponse.mock.calls[0]?.[6]).toMatchObject({
      maxResponseBytes: 20 * 1024 * 1024,
    });
    expect(mocks.fetchAIResponse.mock.calls[0]?.[4]).toEqual({
      model: "mistral-ocr-4-1",
      document: {
        type: "document_url",
        document_url: "https://example.com/report.pdf",
        document_name: "report.pdf",
      },
      pages: "0,2-4",
      include_image_base64: false,
      image_limit: 3,
      image_min_size: 64,
      include_blocks: true,
      confidence_scores_granularity: "block",
      table_format: "html",
      extract_header: true,
      extract_footer: true,
      document_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "report",
          schema: { type: "object", properties: { title: { type: "string" } } },
          strict: true,
        },
      },
      document_annotation_prompt: "Extract the report title",
      bbox_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "figure",
          schema: { type: "object", properties: { kind: { type: "string" } } },
        },
      },
    });
  });

  it.each([
    {
      type: "image_url" as const,
      image_url: "data:image/png;base64,cG5n",
    },
    {
      type: "file" as const,
      file_id: "123e4567-e89b-12d3-a456-426614174000",
    },
  ])("passes $type inputs to Mistral", async (document) => {
    await new MistralOcrProvider().extractText({ env, user, document });

    expect(mocks.fetchAIResponse.mock.calls[0]?.[4]).toMatchObject({ document });
  });

  it("preserves project and parent-output provenance when persisting", async () => {
    await new MistralOcrProvider().extractText({
      env,
      user,
      id: "request-1",
      projectId: "project-1",
      conversationId: "conversation-1",
      parentOutputId: "output-parent",
      document: {
        type: "document_url",
        document_url: "https://example.com/report.pdf",
      },
    });

    expect(mocks.persistOcrOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-1",
        ownerUserId: 42,
        projectId: "project-1",
        conversationId: "conversation-1",
        parentOutputId: "output-parent",
      }),
    );
  });

  it("returns bounded text and the normalised OCR structure", async () => {
    mocks.fetchAIResponse.mockResolvedValue({
      model: "mistral-ocr-4-1",
      pages: [
        {
          index: 0,
          markdown: "x".repeat(25_000),
          images: [],
          dimensions: { dpi: 200, height: 2200, width: 1700 },
          blocks: [
            {
              type: "title",
              top_left_x: 1,
              top_left_y: 2,
              bottom_right_x: 3,
              bottom_right_y: 4,
              content: "Report",
            },
          ],
        },
      ],
      usage_info: { pages_processed: 1, doc_size_bytes: 5000 },
    });

    const result = await new MistralOcrProvider().extractText({
      env,
      user,
      document: {
        type: "document_url",
        document_url: "data:application/pdf;base64,cGRm",
      },
    });

    expect(result.outputId).toBe("output-1");
    expect(result.extractedText).toHaveLength(20_000);
    expect(result.response).toMatchObject({
      model: "mistral-ocr-4-1",
      pages: [
        {
          index: 0,
          blocks: [
            {
              type: "title",
              boundingBox: { topLeftX: 1, topLeftY: 2, bottomRightX: 3, bottomRightY: 4 },
              content: "Report",
            },
          ],
        },
      ],
      usage: { pagesProcessed: 1, documentSizeBytes: 5000 },
    });
  });
});
