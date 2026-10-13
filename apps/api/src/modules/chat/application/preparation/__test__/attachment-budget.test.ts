import { describe, expect, it, vi } from "vitest";

import type { Attachment } from "~/types";

import { attachmentTokenBudget, fitMarkdownAttachments } from "../attachment-budget";

function document(name: string, characters: number): Attachment {
  return { type: "markdown_document", name, markdown: "x".repeat(characters) };
}

describe("fitMarkdownAttachments", () => {
  it("leaves attachments alone when they fit the budget", async () => {
    const digest = vi.fn(async () => "digest");
    const attachments = [document("a.md", 400)];

    await expect(fitMarkdownAttachments(attachments, 1_000, digest)).resolves.toEqual(attachments);
    expect(digest).not.toHaveBeenCalled();
  });

  it("digests the largest documents first and stops once the rest fit", async () => {
    const digest = vi.fn(async (attachment: Attachment) => `digest of ${attachment.name}`);
    const attachments = [
      document("small.md", 2_000),
      document("huge.md", 40_000),
      document("mid.md", 8_000),
    ];

    const fitted = await fitMarkdownAttachments(attachments, 3_000, digest);

    expect(digest.mock.calls.map(([attachment]) => attachment.name)).toEqual(["huge.md"]);
    expect(fitted.map((attachment) => attachment.markdown?.slice(0, 20))).toEqual([
      "x".repeat(20),
      "digest of huge.md",
      "x".repeat(20),
    ]);
  });

  it("reserves a quarter of the window and the user's own text", () => {
    expect(attachmentTokenBudget(100_000, "x".repeat(4_000))).toBe(74_000);
  });
});
