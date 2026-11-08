import { describe, expect, it, vi } from "vitest";

import { readKnowledgeText } from "../body";

function bucket() {
  const objects = new Map<string, string>();

  return {
    objects,
    binding: {
      put: vi.fn(async (key: string, value: string) => {
        objects.set(key, value);
      }),
      get: vi.fn(async (key: string) =>
        objects.has(key) ? { text: async () => objects.get(key) ?? "" } : null,
      ),
    },
  };
}

describe("knowledge bodies", () => {
  it("never reads a body pointer that belongs to another document", async () => {
    const storage = bucket();

    storage.objects.set("knowledge/bodies/other/abc.txt", "someone else's text");

    await expect(
      readKnowledgeText(
        { env: { PRIVATE_ASSETS_BUCKET: storage.binding } as never },
        {
          id: "source-1",
          content: "preview",
          metadata: { body: { key: "knowledge/bodies/other/abc.txt", characters: 9, hash: "h" } },
        },
      ),
    ).resolves.toBe("preview");
    expect(storage.binding.get).not.toHaveBeenCalled();
  });
});
