import { describe, expect, it } from "vitest";

import {
  buildOcrHtml,
  buildOcrMarkdown,
  buildOcrStorageKey,
  normaliseOcrResponse,
  type OcrApiResponse,
} from "./format";

const structuredResponse: OcrApiResponse = {
  model: "mistral-ocr-4-1",
  pages: [
    {
      index: 0,
      markdown:
        '## Summary\n![Diagram](img-0.png)\n[tbl-1.html](tbl-1.html)\n<script>alert("x")</script>',
      images: [
        {
          id: "img-0.png",
          top_left_x: 10,
          top_left_y: 20,
          bottom_right_x: 30,
          bottom_right_y: 40,
          image_base64: "data:image/png;base64,cG5n",
          image_annotation: '{"kind":"chart"}',
        },
      ],
      tables: [
        {
          id: "tbl-1.html",
          content: "<table><tr><td>Total</td></tr></table>",
          format: "html",
          word_confidence_scores: [{ text: "Total", confidence: 0.97, start_index: 0 }],
        },
      ],
      hyperlinks: ["https://example.com"],
      header: "Confidential",
      footer: "Page 1",
      dimensions: { dpi: 200, height: 2200, width: 1700 },
      confidence_scores: {
        average_page_confidence_score: 0.95,
        minimum_page_confidence_score: 0.81,
      },
      blocks: [
        {
          type: "title",
          top_left_x: 10,
          top_left_y: 20,
          bottom_right_x: 300,
          bottom_right_y: 80,
          content: "Summary",
          confidence_scores: {
            average_content_confidence_score: 0.96,
            minimum_content_confidence_score: 0.9,
            block_type_confidence_score: 0.99,
          },
        },
      ],
    },
  ],
  document_annotation: '{"title":"Report"}',
  usage_info: { pages_processed: 1, doc_size_bytes: 4096 },
};

describe("OCR response formatting", () => {
  it("isolates storage keys by trusted personal or project scope", () => {
    expect(buildOcrStorageKey({ ownerUserId: 42, requestId: "run-1", extension: "md" })).toBe(
      "ocr/users/42/run-1/output.md",
    );
    expect(
      buildOcrStorageKey({
        ownerUserId: 42,
        projectId: "project/one",
        requestId: "run/1",
        extension: "json",
      }),
    ).toBe("ocr/projects/project%2Fone/run%2F1/output.json");
  });

  it("preserves OCR 4 structure in a provider-neutral response", () => {
    expect(normaliseOcrResponse(structuredResponse)).toEqual({
      model: "mistral-ocr-4-1",
      pages: [
        {
          index: 0,
          markdown: structuredResponse.pages[0]?.markdown,
          images: [
            {
              id: "img-0.png",
              boundingBox: { topLeftX: 10, topLeftY: 20, bottomRightX: 30, bottomRightY: 40 },
              base64: "data:image/png;base64,cG5n",
              annotation: '{"kind":"chart"}',
            },
          ],
          tables: [
            {
              id: "tbl-1.html",
              content: "<table><tr><td>Total</td></tr></table>",
              format: "html",
              wordConfidenceScores: [{ text: "Total", confidence: 0.97, startIndex: 0 }],
            },
          ],
          hyperlinks: ["https://example.com"],
          header: "Confidential",
          footer: "Page 1",
          dimensions: { dpi: 200, height: 2200, width: 1700 },
          confidenceScores: {
            averagePageConfidenceScore: 0.95,
            minimumPageConfidenceScore: 0.81,
            wordConfidenceScores: [],
          },
          blocks: [
            {
              type: "title",
              boundingBox: { topLeftX: 10, topLeftY: 20, bottomRightX: 300, bottomRightY: 80 },
              content: "Summary",
              confidenceScores: {
                averageContentConfidenceScore: 0.96,
                minimumContentConfidenceScore: 0.9,
                blockTypeConfidenceScore: 0.99,
              },
            },
          ],
        },
      ],
      documentAnnotation: '{"title":"Report"}',
      usage: { pagesProcessed: 1, documentSizeBytes: 4096 },
    });
  });

  it("embeds extracted images and tables without discarding surrounding labels", () => {
    const markdown = buildOcrMarkdown(structuredResponse);

    expect(markdown).toContain("Confidential");
    expect(markdown).toContain("![Diagram](data:image/png;base64,cG5n)");
    expect(markdown).toContain("<table><tr><td>Total</td></tr></table>");
    expect(markdown).toContain("Page 1");
  });

  it("escapes active content in HTML exports", () => {
    const html = buildOcrHtml(structuredResponse);

    expect(html).toContain("<h2>Summary</h2>");
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});
