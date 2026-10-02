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
  CLOUDFLARE_AI_SEARCH_ALLOWED_ORIGINS: "https://docs.example.com",
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

describe("Cloudflare public knowledge retrieval", () => {
  it("uses the namespaced GA API, enforces public metadata and checks every returned source", async () => {
    const chunk = {
      id: "chunk-1",
      type: "text",
      score: 0.8,
      text: "Grounded passage",
      item: { key: "https://docs.example.com/guide", metadata: { is_public: true } },
    };

    fetchMock.mockResolvedValue(
      Response.json({
        success: true,
        result: {
          chunks: [
            chunk,
            { ...chunk, item: { ...chunk.item, metadata: { is_public: false } } },
            {
              ...chunk,
              item: {
                key: "https://docs.example.com.evil.net/guide",
                metadata: { is_public: true },
              },
            },
            { ...chunk, item: { key: "private/user-42.pdf", metadata: { is_public: true } } },
            { ...chunk, item: { key: "https://docs.example.com/guide" } },
          ],
        },
      }),
    );
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
          ai_search_options: {
            retrieval: {
              retrieval_type: "keyword",
              max_num_results: 3,
              filters: { is_public: true },
            },
          },
        }),
      }),
    );
    expect(result).toEqual({
      provider: "cloudflare-ai-search",
      results: [
        {
          title: chunk.item.key,
          url: chunk.item.key,
          snippet: chunk.text,
          score: 0.8,
          chunkId: "chunk-1",
        },
      ],
    });
  });

  it("fails closed for missing origin allowlists and unsafe instance identifiers", async () => {
    await expect(
      new CloudflareAiSearchProvider({
        ...env,
        CLOUDFLARE_AI_SEARCH_ALLOWED_ORIGINS: "",
      }).performWebSearch("query"),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR" });
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
