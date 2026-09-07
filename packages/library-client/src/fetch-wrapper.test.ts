import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiKeyService } from "./api-key";
import { fetchApi } from "./fetch-wrapper";
import { createApiErrorFromResponse } from "./http";

function stubFetch() {
  const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));

  vi.stubGlobal("fetch", fetchSpy);

  return fetchSpy;
}

function stubPendingFetch() {
  const captured: { signal?: AbortSignal } = {};
  let resolveFetch: ((response: Response) => void) | undefined;

  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      captured.signal = init?.signal ?? undefined;

      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }),
  );

  return { captured, settle: () => resolveFetch?.(new Response("{}")) };
}

afterEach(() => {
  apiKeyService.removeApiKey();
  vi.unstubAllGlobals();
});

describe("fetchApi", () => {
  it("signs every request once an access token is held, not only the calls that build headers", async () => {
    const fetchSpy = stubFetch();

    await apiKeyService.setApiKey("a-desktop-access-token");
    await fetchApi("/auth/me");

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];

    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer a-desktop-access-token");
  });

  it("sends nothing extra when the host authenticates with a cookie instead", async () => {
    const fetchSpy = stubFetch();

    await fetchApi("/auth/me");

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];

    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(init.credentials).toBe("include");
  });

  describe("request timeouts", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not abort requests when timeoutMs is null", async () => {
      const { captured, settle } = stubPendingFetch();
      const request = fetchApi("/audio/speech", {
        method: "POST",
        body: { input: "hello" },
        timeoutMs: null,
      });

      await vi.advanceTimersByTimeAsync(15_000);

      expect(captured.signal).toBeUndefined();

      settle();
      await expect(request).resolves.toBeInstanceOf(Response);
    });

    it("keeps the default timeout for requests without an explicit timeout override", async () => {
      const { captured, settle } = stubPendingFetch();
      const request = fetchApi("/models", { method: "GET" });

      await vi.advanceTimersByTimeAsync(15_000);

      expect(captured.signal?.aborted).toBe(true);

      settle();
      await expect(request).resolves.toBeInstanceOf(Response);
    });
  });
});

describe("createApiErrorFromResponse", () => {
  it("preserves response status on API errors", async () => {
    const error = await createApiErrorFromResponse(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    expect(error.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
  });

  it("extracts validation detail messages from API errors", async () => {
    const error = await createApiErrorFromResponse(
      new Response(JSON.stringify({ details: [{ message: "Invalid installation" }] }), {
        status: 400,
        statusText: "Bad Request",
      }),
    );

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid installation");
  });
});
