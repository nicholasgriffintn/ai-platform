import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  performWebSearch: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({ ai: mocks }));
vi.mock("~/modules/models/application/resolve", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/models/application/resolve")>()),
  getAuxiliaryModel: async () => ({ model: "test-model", provider: "test" }),
}));

vi.mock("~/infrastructure/providers/capabilities/search", () => ({
  getSearchProvider: () => ({ performWebSearch: mocks.performWebSearch }),
}));

import { deepWebSearchSchema } from "@ngriffin_uk/polychat-schemas";

import { performDeepWebSearch } from "~/modules/apps/application/retrieval/web-search";
import { getAuxiliarySearchProvider } from "~/modules/models/application/resolve";

import { handleWebSearch } from "./web";

const env: IEnv = {
  ACCOUNT_ID: "test-account",
  ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET_NAME: "private",
  ASSETS_BUCKET_ACCESS_KEY_ID: "",
  ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
  get AI(): never {
    throw new Error("Unexpected AI binding access");
  },
  get DB(): never {
    throw new Error("Unexpected database access");
  },
  get CACHE(): never {
    throw new Error("Unexpected cache access");
  },
  get ANALYTICS(): never {
    throw new Error("Unexpected analytics access");
  },
  get VECTOR_DB(): never {
    throw new Error("Unexpected vector store access");
  },
};
const user: IUser = {
  id: 42,
  email: "user@example.com",
  plan_id: "pro",
  name: null,
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "",
  updated_at: "",
  setup_at: null,
  terms_accepted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.performWebSearch.mockReset();
  mocks.generateObject.mockResolvedValue({ object: { questions: [] } });
  mocks.generateText.mockResolvedValue("Grounded answer");
});
afterEach(() => vi.restoreAllMocks());

describe("platform search access and error propagation", () => {
  it.each(["cloudflare", "cloudflare-ai-search"] as const)(
    "requires Pro for %s and rejects before querying",
    async (provider) => {
      await expect(
        getAuxiliarySearchProvider(env, { ...user, plan_id: "free" }, provider),
      ).rejects.toMatchObject({ type: "AUTHORISATION_ERROR" });
      await expect(getAuxiliarySearchProvider(env, undefined, provider)).rejects.toMatchObject({
        type: "AUTHORISATION_ERROR",
      });
      expect(mocks.performWebSearch).not.toHaveBeenCalled();
      await expect(getAuxiliarySearchProvider(env, user, provider)).resolves.toBe(provider);
    },
  );

  it("propagates an upstream error instead of reporting successful empty results", async () => {
    mocks.performWebSearch.mockResolvedValue({ status: "error", error: "Search unavailable" });
    await expect(
      handleWebSearch({ env, user, provider: "cloudflare", query: "query" }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });
  });

  it("returns evidence and source provenance through the shared search flow", async () => {
    mocks.performWebSearch.mockResolvedValue({
      provider: "cloudflare-ai-search",
      results: [
        {
          title: "Docs",
          url: "https://docs.example.com/guide",
          snippet: "Public passage",
          chunkId: "chunk-1",
        },
      ],
    });
    const result = await handleWebSearch({
      env,
      user,
      provider: "cloudflare-ai-search",
      query: "guide",
    });

    expect(result.data).toMatchObject({
      provider: "cloudflare-ai-search",
      sources: [{ content: "Public passage", chunkId: "chunk-1" }],
    });
  });
});

describe("deep search integration", () => {
  it("forwards Cloudflare controls and retains knowledge passages in citations and answer context", async () => {
    mocks.performWebSearch.mockResolvedValue({
      provider: "cloudflare-ai-search",
      results: [
        {
          title: "Docs",
          url: "https://docs.example.com/guide",
          snippet: "Public passage",
          chunkId: "chunk-1",
        },
      ],
    });
    const body = deepWebSearchSchema.parse({
      query: "guide",
      searchProvider: "cloudflare-ai-search",
      options: { retrieval_type: "keyword", max_results: 3 },
    });
    const result = await performDeepWebSearch(env, user, body);

    expect(mocks.performWebSearch).toHaveBeenCalledWith("guide", {
      retrieval_type: "keyword",
      max_results: 3,
    });
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ system: expect.stringContaining("Public passage") }),
    );
    expect(result).toMatchObject({
      answer: "Grounded answer",
      provider: "cloudflare-ai-search",
      sources: [{ content: "Public passage", chunkId: "chunk-1" }],
    });
  });

  it("returns no matches without generating an unsupported answer when a corpus has no matching passages", async () => {
    mocks.performWebSearch.mockResolvedValue({ provider: "cloudflare-ai-search", results: [] });
    const result = await performDeepWebSearch(env, user, {
      query: "guide",
      searchProvider: "cloudflare-ai-search",
    });

    expect(result.answer).toBe("No matching sources were found.");
    expect(result.sources).toEqual([]);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("stops answer generation on provider failure and rejects unregistered providers at the API boundary", async () => {
    mocks.performWebSearch.mockResolvedValue({ status: "error", error: "Search unavailable" });
    await expect(
      performDeepWebSearch(env, user, { query: "query", searchProvider: "cloudflare" }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(
      deepWebSearchSchema.safeParse({ query: "query", searchProvider: "unregistered" }).success,
    ).toBe(false);
  });
});
