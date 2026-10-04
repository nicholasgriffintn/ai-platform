import { describe, expect, it } from "vitest";

import { ocrBatchStartRequestSchema } from "./ocr-batch.js";

describe("ocrBatchStartRequestSchema", () => {
  it("rejects oversized batches", () => {
    const result = ocrBatchStartRequestSchema.safeParse({
      requests: Array.from({ length: 26 }, (_, index) => ({
        document: { type: "source", source_id: `source-${index}` },
      })),
    });

    expect(result.success).toBe(false);
  });
});
