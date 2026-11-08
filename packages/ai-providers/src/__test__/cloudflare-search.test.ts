import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudflareAiSearchProvider } from "../capabilities/search/providers/CloudflareAiSearchProvider.js";
import { CloudflareWebSearchProvider } from "../capabilities/search/providers/CloudflareWebSearchProvider.js";
import type { ProviderEnv } from "../env.js";

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
  it("rejects unsafe instance identifiers before sending a request", async () => {
    await expect(
      new CloudflareAiSearchProvider({
        ...env,
        CLOUDFLARE_AI_SEARCH_INSTANCE: "../private",
      }).performWebSearch("query"),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
