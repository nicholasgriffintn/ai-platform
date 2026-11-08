import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GreenPtOcrProvider } from "../capabilities/ocr/providers/GreenPtOcrProvider.js";
import type { ProviderEnv, ProviderUser } from "../env.js";
import { createTestRuntime, createTestStorage } from "./test-runtime.js";

const env: ProviderEnv = { GREENPT_API_KEY: "greenpt-key" };
const user: ProviderUser = { id: 42, plan_id: "pro" };
const runtime = createTestRuntime({
  storage: { forEnv: () => null, forContext: () => createTestStorage() },
});
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GreenPtOcrProvider", () => {
  it("refuses to fetch private or non-HTTP document URLs", async () => {
    const provider = new GreenPtOcrProvider(runtime);

    await expect(
      provider.extractText({
        env,
        user,
        document: { type: "document_url", document_url: "http://169.254.169.254/latest" },
      }),
    ).rejects.toThrow("public HTTP(S) URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses redirects from public document URLs to private hosts", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest" },
      }),
    );

    await expect(
      new GreenPtOcrProvider(runtime).extractText({
        env,
        user,
        document: { type: "document_url", document_url: "https://files.example/report.pdf" },
      }),
    ).rejects.toThrow("public HTTP(S) URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
