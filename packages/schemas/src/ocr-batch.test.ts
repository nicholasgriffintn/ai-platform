import { describe, expect, it } from "vitest";

import { ocrBatchStartRequestSchema } from "./ocr-batch";

describe("ocrBatchStartRequestSchema", () => {
  it("accepts public and private OCR inputs with OCR 4 options", () => {
    const result = ocrBatchStartRequestSchema.safeParse({
      title: "Archive OCR",
      requests: [
        {
          document: { type: "source", source_id: "source-1" },
          pages: "0,2-4",
          include_blocks: true,
          confidence_scores_granularity: "block",
        },
        {
          document: {
            type: "image_url",
            image_url: "https://example.com/scan.png",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized batches", () => {
    const result = ocrBatchStartRequestSchema.safeParse({
      requests: Array.from({ length: 26 }, (_, index) => ({
        document: { type: "source", source_id: `source-${index}` },
      })),
    });

    expect(result.success).toBe(false);
  });
});
