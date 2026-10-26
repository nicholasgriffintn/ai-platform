import {
  KNOWLEDGE_BODY_PREVIEW_CHARACTERS,
  KNOWLEDGE_INLINE_BODY_CHARACTERS,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { prepareKnowledgeBody, readKnowledgeText } from "../body";

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
  it("keeps short text in the database and moves long text to storage with a preview", async () => {
    const storage = bucket();
    const env = { PRIVATE_ASSETS_BUCKET: storage.binding as unknown as R2Bucket };
    const short = await prepareKnowledgeBody(env, "source-1", "Short note", null);
    const long = "x".repeat(KNOWLEDGE_INLINE_BODY_CHARACTERS + 1);
    const stored = await prepareKnowledgeBody(env, "source-1", long, null);

    expect(short).toEqual({ content: "Short note", body: null, staleKey: null, changed: false });
    expect(stored.content).toHaveLength(KNOWLEDGE_BODY_PREVIEW_CHARACTERS);
    expect(stored.body?.key.startsWith("knowledge/bodies/source-1/")).toBe(true);
    expect(stored.changed).toBe(true);
    await expect(
      readKnowledgeText(
        { env: env as never },
        { id: "source-1", content: stored.content, metadata: { body: stored.body } },
      ),
    ).resolves.toBe(long);

    const unchanged = await prepareKnowledgeBody(env, "source-1", long, stored.body);

    expect(unchanged.changed).toBe(false);
    expect(storage.binding.put).toHaveBeenCalledTimes(1);
  });

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
