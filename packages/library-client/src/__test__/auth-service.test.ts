import { afterEach, describe, expect, it, vi } from "vitest";

import { authService } from "../auth-service.js";

function respondWith(...responses: Array<Response | Error>) {
  const fetchSpy = vi.fn();

  for (const response of responses) {
    if (response instanceof Error) {
      fetchSpy.mockRejectedValueOnce(response);
    } else {
      fetchSpy.mockResolvedValueOnce(response);
    }
  }

  vi.stubGlobal("fetch", fetchSpy);
}

function signedIn() {
  return Response.json({ user: { id: 7, plan_id: "pro" }, userSettings: {} });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authService.checkAuthStatus", () => {
  it("keeps the signed-in account through a dropped connection or server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    respondWith(signedIn(), new TypeError("Failed to fetch"), new Response(null, { status: 503 }));

    expect(await authService.checkAuthStatus()).toBe(true);
    expect(await authService.checkAuthStatus()).toBe(true);
    expect(await authService.checkAuthStatus()).toBe(true);
    expect(authService.getUser()?.id).toBe(7);
  });

  it("signs out when the API answers that nobody is signed in", async () => {
    respondWith(signedIn(), Response.json({ user: null, userSettings: null }));

    await authService.checkAuthStatus();

    expect(await authService.checkAuthStatus()).toBe(false);
    expect(authService.getUser()).toBeNull();
  });

  it("signs out when the API rejects the session", async () => {
    respondWith(signedIn(), new Response(null, { status: 401 }));

    await authService.checkAuthStatus();

    expect(await authService.checkAuthStatus()).toBe(false);
    expect(authService.getUser()).toBeNull();
  });
});
