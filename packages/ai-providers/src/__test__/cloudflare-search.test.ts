import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudflareAiSearchProvider } from "../capabilities/search/providers/CloudflareAiSearchProvider.js";
import { CloudflareWebSearchProvider } from "../capabilities/search/providers/CloudflareWebSearchProvider.js";
import { createProviderLibrary } from "../create-library.js";
import type { ProviderEnv } from "../env.js";
import { createTestHost } from "./test-runtime.js";

const env: ProviderEnv = {
  ACCOUNT_ID: "account",
  CLOUDFLARE_WEB_SEARCH_TOKEN: "web-token",
  CLOUDFLARE_AI_SEARCH_TOKEN: "knowledge-token",
  CLOUDFLARE_AI_SEARCH_INSTANCE: "public-docs",
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare web search", () => {
  it("resolves through the registry, routes to our gateway and preserves source snippets", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        items: [
          { url: "https://example.com/page", title: "Page", description: "Live evidence" },
          { url: "javascript:alert(1)", title: "Unsafe" },
          { url: "https://localhost/private", title: "Private" },
        ],
        metadata: { requestId: "search-1", latencyMs: 30 },
      }),
    );
    const library = createProviderLibrary({ host: createTestHost() });
    const provider = library.resolve("search", "cloudflare", { env });
    const result = await provider.performWebSearch("fresh evidence", {
      cloudflare_provider: "exa",
      max_results: 50,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/websearch/",
      expect.objectContaining({
        redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: "Bearer web-token" },
        body: JSON.stringify({
          query: "fresh evidence",
          provider: "exa",
          limit: 10,
          options: { gateway: { id: "llm-assistant" } },
        }),
      }),
    );
    expect(result).toEqual({
      provider: "cloudflare",
      searchProvider: "exa",
      requestId: "search-1",
      results: [{ title: "Page", url: "https://example.com/page", snippet: "Live evidence" }],
    });
  });

  it("passes only the operator's BYOK alias and defaults to Ceramic", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [] }));
    await new CloudflareWebSearchProvider({
      ...env,
      CLOUDFLARE_WEB_SEARCH_BYOK_ALIAS: "platform-key",
    }).performWebSearch("query");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        query: "query",
        provider: "ceramic",
        byokAlias: "platform-key",
        limit: 10,
        options: { gateway: { id: "llm-assistant" } },
      }),
    );
  });

  it("rejects invalid requests and missing configuration before spending credits", async () => {
    const provider = new CloudflareWebSearchProvider(env);

    await expect(provider.performWebSearch(" ")).rejects.toMatchObject({ type: "PARAMS_ERROR" });
    await expect(provider.performWebSearch("q".repeat(1025))).rejects.toMatchObject({
      type: "PARAMS_ERROR",
    });
    await expect(provider.performWebSearch("query", { max_results: 0 })).rejects.toMatchObject({
      type: "PARAMS_ERROR",
    });
    await expect(
      new CloudflareWebSearchProvider({ ACCOUNT_ID: "account" }).performWebSearch("query"),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response("upstream credentials or query", { status: 429 }),
    () => Response.json({ success: false, errors: [{ message: "private" }] }),
    () => new Response("invalid json"),
  ])("returns a safe error for failed or malformed responses", async (response) => {
    fetchMock.mockResolvedValue(response());
    const result = await new CloudflareWebSearchProvider(env).performWebSearch("query");

    expect(result).toMatchObject({ status: "error" });
    expect(JSON.stringify(result)).not.toMatch(/credentials|private|web-token/);
  });
});

describe("Cloudflare knowledge retrieval", () => {
  it("uses the namespaced GA API and preserves every returned chunk without cache or metadata overrides", async () => {
    const chunks = [
      {
        id: "chunk-1",
        type: "text",
        score: 0.8,
        text: "Grounded passage",
        scoring_details: { vector_score: 0.8 },
        item: { key: "https://docs.example.com/guide" },
      },
      {
        id: "chunk-2",
        type: "text",
        score: 0.7,
        text: "Document passage",
        item: { key: "documents/guide.pdf" },
      },
      {
        id: "chunk-3",
        type: "image",
        score: 0.6,
        text: "Image description",
        item: { key: "images/diagram.png" },
      },
      { id: "chunk-4", type: "text", score: 0.5, text: "Passage without an item" },
    ];

    fetchMock.mockResolvedValue(Response.json({ success: true, result: { chunks } }));
    const result = await new CloudflareAiSearchProvider(env).performWebSearch("guide", {
      retrieval_type: "keyword",
      max_results: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account/ai-search/namespaces/default/instances/public-docs/search",
      expect.objectContaining({
        headers: { "Content-Type": "application/json", Authorization: "Bearer knowledge-token" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "guide" }],
          ai_search_options: { retrieval: { retrieval_type: "keyword", max_num_results: 3 } },
        }),
      }),
    );
    expect(result).toMatchObject({
      provider: "cloudflare-ai-search",
      chunks,
      results: [
        {
          title: "https://docs.example.com/guide",
          url: "https://docs.example.com/guide",
          snippet: "Grounded passage",
          chunkId: "chunk-1",
        },
        {
          title: "documents/guide.pdf",
          url: "documents/guide.pdf",
          snippet: "Document passage",
          chunkId: "chunk-2",
        },
        {
          title: "images/diagram.png",
          url: "images/diagram.png",
          snippet: "Image description",
          chunkId: "chunk-3",
        },
        { title: "chunk-4", url: "", snippet: "Passage without an item", chunkId: "chunk-4" },
      ],
    });
  });

  it("rejects unsafe instance identifiers before sending a request", async () => {
    await expect(
      new CloudflareAiSearchProvider({
        ...env,
        CLOUDFLARE_AI_SEARCH_INSTANCE: "../private",
      }).performWebSearch("query"),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unsuccessful envelope as an error rather than an empty successful search", async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false, errors: [] }));
    expect(await new CloudflareAiSearchProvider(env).performWebSearch("query")).toMatchObject({
      status: "error",
    });
  });
});
