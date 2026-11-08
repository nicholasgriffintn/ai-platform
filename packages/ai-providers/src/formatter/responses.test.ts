import { describe, expect, it } from "vitest";

import { ResponseFormatter } from "./responses.js";

describe("generated media without storage", () => {
  it("refuses to return base64 media that could not be marked", async () => {
    await expect(
      ResponseFormatter.formatResponse({ image: "aGVsbG8=" }, "workers-ai", {
        modalities: { input: ["text"], output: ["image"] },
      }),
    ).rejects.toThrow("private storage");
  });

  it("refuses to hand back a provider URL that could not be marked", async () => {
    await expect(
      ResponseFormatter.formatResponse(
        { output: ["https://replicate.delivery/a/out.mp4"] },
        "replicate",
        { modalities: { input: ["text"], output: ["video"] } },
      ),
    ).rejects.toThrow("private storage");
  });
});
