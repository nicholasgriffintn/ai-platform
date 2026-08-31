import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { convertBlobToMarkdownViaCloudflare } from "./documentConverter";

function createEnv(toMarkdown: (files: unknown[]) => Promise<unknown>): IEnv {
  return { AI: { toMarkdown } } as IEnv;
}

describe("convertBlobToMarkdownViaCloudflare", () => {
  it("accepts the current Cloudflare conversion response contract", async () => {
    const toMarkdown = vi.fn().mockResolvedValue([
      {
        id: "conversion-1",
        name: "document.pdf",
        format: "markdown",
        mimetype: "application/pdf",
        tokens: 12,
        data: "# Converted document",
      },
    ]);

    const result = await convertBlobToMarkdownViaCloudflare(
      createEnv(toMarkdown),
      new Blob(["document"], { type: "application/pdf" }),
      "document.pdf",
    );

    expect(result).toEqual({ result: "# Converted document" });
  });

  it("requests and accepts plain-text conversion", async () => {
    const toMarkdown = vi.fn().mockResolvedValue([
      {
        id: "conversion-2",
        name: "document.docx",
        format: "text",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tokens: 5,
        data: "Converted document",
      },
    ]);
    const blob = new Blob(["document"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await convertBlobToMarkdownViaCloudflare(
      createEnv(toMarkdown),
      blob,
      "document.docx",
      { output: { format: "text" } },
    );

    expect(result).toEqual({ result: "Converted document" });
    expect(toMarkdown).toHaveBeenCalledWith([{ name: "document.docx", blob }], {
      conversionOptions: { output: { format: "text" } },
    });
  });

  it("returns errors from the current Cloudflare response contract", async () => {
    const toMarkdown = vi.fn().mockResolvedValue([
      {
        id: "conversion-3",
        name: "document.pdf",
        format: "error",
        mimetype: "application/pdf",
        error: "The document could not be converted",
      },
    ]);

    const result = await convertBlobToMarkdownViaCloudflare(
      createEnv(toMarkdown),
      new Blob(["document"], { type: "application/pdf" }),
      "document.pdf",
    );

    expect(result).toEqual({ error: "The document could not be converted" });
  });
});
