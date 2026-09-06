import { afterEach, describe, expect, it, vi } from "vitest";

import { apiKeyService } from "./api-key";
import { fetchApi } from "./fetch-wrapper";

function stubFetch() {
  const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));

  vi.stubGlobal("fetch", fetchSpy);

  return fetchSpy;
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
});
