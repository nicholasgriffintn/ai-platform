import { describe, expect, it } from "vitest";

import { listSourceMetadata } from "../list-metadata";

describe("listSourceMetadata", () => {
  it("keeps the fields lists read and drops the detail-only payload", () => {
    const listed = listSourceMetadata({
      syncId: "sync-1",
      generation: { type: "podcast", modelName: "Voice" },
      summary: { summary: "Long summary", keyPoints: ["One"] },
      enrichments: [{ kind: "entity" }],
      classification: { label: "news" },
      framing: { slant: "neutral" },
      discoverCoverage: { overview: "Coverage" },
      media: {
        cover: { key: "cover.png", mimeType: "image/png" },
        durationSeconds: 90,
        notes: { summary: "Notes", decisions: [], actionItems: [] },
        transcript: { status: "ready", speakers: { a: "Ann" }, segments: [{ text: "Hello" }] },
      },
      listen: { status: "ready", contentHash: "hash", passages: [{ text: "Hi", audio: true }] },
    });

    expect(listed).toEqual({
      syncId: "sync-1",
      generation: { type: "podcast", modelName: "Voice" },
      media: {
        cover: { key: "cover.png", mimeType: "image/png" },
        durationSeconds: 90,
        transcript: { status: "ready" },
      },
      listen: { status: "ready", contentHash: "hash", passages: [] },
    });
  });

  it("keeps a failed transcript's error for the list", () => {
    expect(
      listSourceMetadata({ media: { transcript: { status: "failed", error: "No audio" } } }),
    ).toEqual({ media: { transcript: { status: "failed", error: "No audio" } } });
  });
});
