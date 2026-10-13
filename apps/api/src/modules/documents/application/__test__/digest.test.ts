import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { DOCUMENT_DIGEST_CHUNK_CHARS, digestDocument, formatDocumentDigest } from "../digest";

const generateObject = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/ai", () => ({ ai: { generateObject } }));
vi.mock("~/modules/models/application/resolve", () => ({
  getAuxiliaryModel: async () => ({ model: "aux", provider: "workers-ai", effort: undefined }),
}));

const USER = { id: 11, plan_id: "pro" } as unknown as IUser;

function kv() {
  const store = new Map<string, string>();

  return {
    store,
    binding: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: vi.fn(),
    },
  };
}

function longDocument(parts: number): string {
  return Array.from({ length: parts }, (_, index) =>
    `Part-${index + 1}`.padEnd(DOCUMENT_DIGEST_CHUNK_CHARS - 1, "w"),
  ).join("\n");
}

describe("digestDocument", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { KVCache } = await import("~/infrastructure/cache");

    KVCache.clearMemoryCache();
  });

  it("summarises every part, builds the overview from them and caches a complete digest", async () => {
    generateObject.mockImplementation(async ({ name, prompt }: { name: string; prompt: string }) =>
      name === "document_section"
        ? {
            object: {
              title: prompt.trim().slice(0, 6),
              summary: `About ${prompt.trim().slice(0, 6)}`,
            },
          }
        : { object: { overview: `Overview of: ${prompt}` } },
    );
    const cache = kv();
    const env = { CACHE: cache.binding } as unknown as IEnv;

    const digest = await digestDocument({ env, user: USER, markdown: longDocument(2) });
    const again = await digestDocument({ env, user: USER, markdown: longDocument(2) });

    expect(digest.sections).toEqual([
      { title: "Part-1", summary: "About Part-1" },
      { title: "Part-2", summary: "About Part-2" },
    ]);
    expect(digest.overview).toContain("## Part-2\n\nAbout Part-2");
    expect(again).toEqual(digest);
    expect(generateObject).toHaveBeenCalledTimes(3);
  });

  it("keeps going when a part fails, says so, and does not cache the gap", async () => {
    generateObject.mockImplementation(
      async ({ name, prompt }: { name: string; prompt: string }) => {
        if (name === "document_section" && prompt.trim().startsWith("Part-2")) {
          throw new Error("model timed out");
        }

        return name === "document_section"
          ? { object: { title: prompt.trim().slice(0, 6), summary: "Kept" } }
          : { object: { overview: "Partial overview" } };
      },
    );
    const cache = kv();
    const env = { CACHE: cache.binding } as unknown as IEnv;

    const digest = await digestDocument({ env, user: USER, markdown: longDocument(2) });

    expect(digest.sections).toEqual([{ title: "Part-1", summary: "Kept" }, null]);
    expect(cache.store.size).toBe(0);
    expect(formatDocumentDigest("report.pdf", digest)).toContain(
      "1 part(s) could not be summarised and are missing.",
    );
  });
});
